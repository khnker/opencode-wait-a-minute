import {
  AGENT_ROLES,
  assertAgentRequest,
  assertAgentResult,
  getRoleCapabilities,
  getRoleDefinition,
  getRoleStage,
} from "./role-contracts.js";
import { AGENT_RESOURCE_LIMITS } from "./resource-policy.js";
import { assertResultIdentity, normalizeAgentResult } from "./result-boundary.js";
import { resolveRoleSkills } from "./role-skills.js";

export const AGENT_INVOCATION_ERROR_CODES = Object.freeze({
  SESSION_CREATE_FAILED: "SESSION_CREATE_FAILED",
  PROMPT_FAILED: "PROMPT_FAILED",
  PROMPT_TIMEOUT: "PROMPT_TIMEOUT",
  INVALID_RESULT: "INVALID_RESULT",
});

const READ_ONLY_TOOLS = Object.freeze({
  read: true,
  grep: true,
  glob: true,
  list: true,
  webfetch: true,
  bash: false,
  edit: false,
  write: false,
  patch: false,
  multiedit: false,
  apply_patch: false,
  task: false,
  todowrite: false,
  skill: false,
  question: false,
});

const BUILDER_TOOLS = Object.freeze({
  ...READ_ONLY_TOOLS,
  bash: true,
  edit: true,
  write: true,
  patch: true,
  multiedit: true,
  apply_patch: true,
});

export class AgentInvocationError extends Error {
  constructor(message, { code = "INVOCATION_FAILED", cause, sessionID } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AgentInvocationError";
    this.code = code;
    if (sessionID) this.sessionID = sessionID;
  }
}

function withTimeout(promise, ms, makeError) {
  if (!(ms > 0)) return promise;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(makeError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isPromptTimeoutCause(error) {
  const seen = new Set();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    if (
      cause.name === "AbortError" ||
      cause.name === "TimeoutError" ||
      cause.code === "ABORT_ERR" ||
      /timed? ?out|timeout/i.test(typeof cause.message === "string" ? cause.message : "")
    ) {
      return true;
    }
    cause = cause.cause;
  }
  return false;
}

export function toolPolicyForRole(role) {
  const capabilities = getRoleCapabilities(role);
  return capabilities.modifyCode ? BUILDER_TOOLS : READ_ONLY_TOOLS;
}

function renderList(items, format) {
  if (!items.length) return "- (none)";
  return items.map(format).join("\n");
}

function renderCriteria(criteria) {
  return renderList(criteria, (criterion) => {
    const mandatory = criterion.mandatory ? "mandatory" : "optional";
    const evidence = criterion.evidenceRequirements
      ? ` | evidence: ${JSON.stringify(criterion.evidenceRequirements)}`
      : "";
    return `- ${criterion.id} [${mandatory}]: ${criterion.description}${evidence}`;
  });
}

function renderPriorFindings(findings) {
  return renderList(findings, (finding) => {
    const criterion = finding.criterionId ? ` (${finding.criterionId})` : "";
    const evidence = finding.evidence.length ? ` | evidence: ${finding.evidence.join(", ")}` : "";
    return `- [${finding.severity}] ${finding.id}${criterion}: ${finding.description}${evidence}`;
  });
}

function renderReviewArtifacts(artifacts) {
  return renderList(artifacts, (artifact) => `- ${artifact.ref}:\n${artifact.content}`);
}

function buildResultShape(request) {
  const shape = {
    taskId: request.taskId,
    invocationId: request.invocationId,
    role: request.role,
    status: "COMPLETED",
    summary: "string",
    findings: [
      {
        id: "string",
        description: "string",
        severity: "LOW|MEDIUM|HIGH|CRITICAL",
        evidence: ["string"],
        criterionId: "optional string",
      },
    ],
    artifacts: ["string"],
    evidence: ["string"],
    openQuestions: ["string"],
    recommendations: ["string"],
    limitations: ["string"],
  };
  if (getRoleCapabilities(request.role).proposeDecisions === true) {
    shape.decisions = [{ id: "string", description: "string", rationale: "string" }];
  }
  if (request.role === AGENT_ROLES.REVIEWER) {
    shape.review = {
      verdict: "ACCEPTED|REVISION_REQUIRED|REPLAN_REQUIRED|BLOCKED",
      findings: [
        {
          criterionId: "optional string",
          severity: "LOW|MEDIUM|HIGH|CRITICAL",
          description: "string",
          evidence: ["string"],
          correctiveAction: "string",
        },
      ],
      limitations: ["string"],
    };
  }
  return JSON.stringify(shape, null, 2);
}

export function buildAgentSystemPrompt(request, { root = null, roleSkills = null } = {}) {
  const definition = getRoleDefinition(request.role);
  const stage = getRoleStage(request.role);
  const loadedSkills = roleSkills || (root ? resolveRoleSkills(request.role, { root }) : null);
  const reviewerRule =
    request.role === AGENT_ROLES.REVIEWER
      ? "Include `review` unless status is FAILED. Revision and replan verdicts require at least one finding with evidence. If a review artifact shows a failing test, a contradiction with the implementation, or a missing required file, return REVISION_REQUIRED with a finding that cites the artifact ref; treat an artifact as stale only when newer evidence in this prompt contradicts it."
      : "Do not include a `review` field.";

  return [
    `You are the WAM ${request.role} role.`,
    `Responsibility: ${definition.responsibility}.`,
    ...(stage ? [`Loop stage: ${stage.index}/${stage.total} — ${stage.label}.`] : []),
    ...(definition.layer ? [`Layer: ${definition.layer}.`] : []),
    ...(definition.focus ? [`Focus: ${definition.focus}.`] : []),
    ...(definition.skills?.length ? [`Preferred skills: ${definition.skills.join(", ")}.`] : []),
    "Limits:",
    renderList(definition.limits, (limit) => `- ${limit}`),
    "",
    "WAM is the only coordinator. Do not modify WAM task state, contracts, approvals, artifacts or evidence.",
    "Do not invoke another role. Do not claim task completion or approval.",
    reviewerRule,
    "Return exactly one JSON object and no prose or multiple objects. A single Markdown code fence is allowed.",
    "Do not ask the user questions; put unknowns in openQuestions.",
    "Use the supplied taskId, invocationId and role unchanged.",
    "The object MUST match this shape:",
    buildResultShape(request),
    ...(loadedSkills?.text ? ["", loadedSkills.text] : []),
  ].join("\n");
}

export function buildAgentUserPrompt(request) {
  return [
    `Objective: ${request.objective}`,
    "",
    "Acceptance criteria:",
    renderCriteria(request.acceptanceCriteria),
    "",
    "Artifacts:",
    renderList(request.input.artifacts, (item) => `- ${item}`),
    "",
    "Evidence:",
    renderList(request.input.evidence, (item) => `- ${item}`),
    "",
    "Review artifacts:",
    renderReviewArtifacts(request.input.reviewArtifacts || []),
    "",
    "Constraints:",
    renderList(request.input.constraints, (item) => `- ${item}`),
    "",
    "Prior findings:",
    renderPriorFindings(request.input.priorFindings),
    "",
    "Expected output:",
    renderList(request.expectedOutput, (item) => `- ${item}`),
  ].join("\n");
}

export function buildAgentPrompt(request, options = {}) {
  return {
    system: buildAgentSystemPrompt(request, options),
    text: buildAgentUserPrompt(request),
  };
}

function stripSingleCodeFence(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const lines = trimmed.split("\n");
  if (lines.length < 3 || lines[lines.length - 1].trim() !== "```") return trimmed;
  return lines.slice(1, -1).join("\n").trim();
}

function escapeControlCharsInJsonStrings(text) {
  let escapedText = "";
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        escapedText += char;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        escapedText += char;
        continue;
      }
      if (char === '"') {
        inString = false;
        escapedText += char;
        continue;
      }
      const code = char.codePointAt(0);
      if (char === "\n") escapedText += "\\n";
      else if (char === "\r") escapedText += "\\r";
      else if (char === "\t") escapedText += "\\t";
      else if (code < 0x20) escapedText += `\\u${code.toString(16).padStart(4, "0")}`;
      else escapedText += char;
      continue;
    }
    if (char === '"') inString = true;
    escapedText += char;
  }
  return escapedText;
}

function extractBalancedJsonObjects(text) {
  const objects = [];
  let inString = false;
  let escaped = false;
  let depth = 0;
  let start = -1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return objects;
}

export function parseAgentResultText(text) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new AgentInvocationError("agent response is empty", {
      code: AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT,
    });
  }
  const stripped = stripSingleCodeFence(text);
  const candidates = [stripped, ...extractBalancedJsonObjects(stripped)];
  let cause;
  for (const candidate of candidates) {
    for (const attempt of [candidate, escapeControlCharsInJsonStrings(candidate)]) {
      try {
        return JSON.parse(attempt);
      } catch (error) {
        if (!cause) cause = error;
      }
    }
  }
  throw new AgentInvocationError("agent response is not valid JSON", {
    code: AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT,
    cause,
  });
}

function sessionErrorMessage(data) {
  const error = data?.info?.error ?? data?.error;
  if (!error) return null;
  const detail = error?.data?.message || error?.message || error?.name || String(error);
  const status = error?.data?.statusCode;
  return `agent session error: ${detail}${status ? ` (${status})` : ""}`;
}

const NON_RETRYABLE_PROMPT_STATUS_CODES = new Set([400, 401, 403, 404, 422]);

function promptErrorStatus(error) {
  const raw = error?.data?.statusCode ?? error?.status ?? error?.statusCode;
  const status = Number(raw);
  return Number.isFinite(status) ? status : null;
}

function promptErrorFromResponse(response, sessionID) {
  const cause = response?.info?.error ?? response?.error;
  const status = promptErrorStatus(cause);
  const nonRetryable =
    status !== null && NON_RETRYABLE_PROMPT_STATUS_CODES.has(status);
  let message = sessionErrorMessage(response) ?? "agent session error";
  if (nonRetryable && !message.includes(`(${status})`)) {
    message = `${message} (${status})`;
  }
  return new AgentInvocationError(message, {
    code: nonRetryable
      ? AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT
      : AGENT_INVOCATION_ERROR_CODES.PROMPT_FAILED,
    cause,
    sessionID,
  });
}

function responseText(parts) {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function promptBody(request, agent, root) {
  const prompt = buildAgentPrompt(request, { root });
  return {
    ...(agent ? { agent } : {}),
    system: prompt.system,
    tools: toolPolicyForRole(request.role),
    parts: [{ type: "text", text: prompt.text }],
  };
}

export function createOpenCodeV1AgentAdapter({
  client,
  directory,
  parentSessionID,
  agent,
} = {}) {
  if (!client?.session?.create || !client?.session?.prompt) {
    throw new TypeError("OpenCode V1 adapter requires client.session.create and client.session.prompt");
  }
  if (agent !== undefined && (typeof agent !== "string" || agent.trim() === "")) {
    throw new TypeError("agent must be a non-empty string when provided");
  }

  return {
    async invoke(request, overrides = {}) {
      assertAgentRequest(request);

      if (overrides.agent !== undefined && (typeof overrides.agent !== "string" || overrides.agent.trim() === "")) {
        throw new TypeError("agent must be a non-empty string when provided");
      }

      const root = overrides.directory || directory;
      const invocationAgent = overrides.agent || agent;
      const query = root ? { query: { directory: root } } : {};
      const rawTimeout = overrides.toolTimeoutMs === undefined || overrides.toolTimeoutMs === null
        ? undefined
        : Number(overrides.toolTimeoutMs);
      const timeoutMs = rawTimeout === undefined || Number.isNaN(rawTimeout)
        ? AGENT_RESOURCE_LIMITS.maxInvocationMs
        : rawTimeout;
      const signal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

      let session;
      try {
        const created = await withTimeout(
          client.session.create({
            ...query,
            ...(signal ? { signal } : {}),
            body: {
              ...(parentSessionID ? { parentID: parentSessionID } : {}),
              title: `WAM ${request.role} ${request.taskId} ${request.invocationId}`,
            },
          }),
          timeoutMs,
          () => new AgentInvocationError(
            `agent session create timeout after ${timeoutMs}ms`,
            { code: AGENT_INVOCATION_ERROR_CODES.SESSION_CREATE_FAILED },
          ),
        );
        if (created?.error) throw created.error;
        session = created?.data ?? created;
        if (!session?.id) throw new Error("session.create returned no session id");
        try { overrides.onSessionCreated?.(session.id); } catch {}
      } catch (cause) {
        if (cause instanceof AgentInvocationError) throw cause;
        throw new AgentInvocationError("failed to create agent session", {
          code: AGENT_INVOCATION_ERROR_CODES.SESSION_CREATE_FAILED,
          cause,
        });
      }

      let response;
      try {
        response = await withTimeout(
          client.session.prompt({
            path: { id: session.id },
            ...query,
            ...(signal ? { signal } : {}),
            body: promptBody(request, invocationAgent, root),
          }),
          timeoutMs,
          () => new AgentInvocationError(
            `agent prompt timeout after ${timeoutMs}ms`,
            { code: AGENT_INVOCATION_ERROR_CODES.PROMPT_TIMEOUT, sessionID: session.id },
          ),
        );
        if (response?.error) throw promptErrorFromResponse(response, session.id);
      } catch (cause) {
        if (cause instanceof AgentInvocationError) {
          if (!cause.sessionID) cause.sessionID = session.id;
          throw cause;
        }
        if (signal?.aborted || isPromptTimeoutCause(cause)) {
          throw new AgentInvocationError(
            `agent prompt timeout after ${timeoutMs}ms`,
            {
              code: AGENT_INVOCATION_ERROR_CODES.PROMPT_TIMEOUT,
              cause,
              sessionID: session.id,
            },
          );
        }
        throw new AgentInvocationError("failed to prompt agent session", {
          code: AGENT_INVOCATION_ERROR_CODES.PROMPT_FAILED,
          cause,
          sessionID: session.id,
        });
      }

      const data = response?.data ?? response;
      try {
        const failure = sessionErrorMessage(data);
        if (failure) {
          throw new AgentInvocationError(failure, {
            code: AGENT_INVOCATION_ERROR_CODES.PROMPT_FAILED,
            cause: data?.info?.error ?? data?.error,
            sessionID: session.id,
          });
        }
        const result = normalizeAgentResult(
          parseAgentResultText(responseText(data?.parts)),
        );
        assertAgentResult(result);
        assertResultIdentity(result, request);
        return { result, metadata: { sessionID: session.id } };
      } catch (cause) {
        if (cause instanceof AgentInvocationError) {
          if (!cause.sessionID) cause.sessionID = session.id;
          throw cause;
        }
        throw new AgentInvocationError(
          `agent returned an invalid result${cause instanceof Error ? `: ${cause.message}` : ""}`,
          {
            code: AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT,
            cause,
            sessionID: session.id,
          },
        );
      }
    },
  };
}
