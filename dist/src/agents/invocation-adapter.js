import {
  AGENT_ROLES,
  assertAgentRequest,
  assertAgentResult,
  getRoleCapabilities,
  getRoleDefinition,
} from "./role-contracts.js";

export const AGENT_INVOCATION_ERROR_CODES = Object.freeze({
  SESSION_CREATE_FAILED: "SESSION_CREATE_FAILED",
  PROMPT_FAILED: "PROMPT_FAILED",
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
    decisions: [{ id: "string", description: "string", rationale: "string" }],
    artifacts: ["string"],
    evidence: ["string"],
    openQuestions: ["string"],
    recommendations: ["string"],
    limitations: ["string"],
  };
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

export function buildAgentSystemPrompt(request) {
  const definition = getRoleDefinition(request.role);
  const reviewerRule =
    request.role === AGENT_ROLES.REVIEWER
      ? "Include `review` unless status is FAILED. Revision and replan verdicts require at least one finding with evidence."
      : "Do not include a `review` field.";

  return [
    `You are the WAM ${request.role} role.`,
    `Responsibility: ${definition.responsibility}.`,
    "Limits:",
    renderList(definition.limits, (limit) => `- ${limit}`),
    "",
    "WAM is the only coordinator. Do not modify WAM task state, contracts, approvals, artifacts or evidence.",
    "Do not invoke another role. Do not claim task completion or approval.",
    reviewerRule,
    "Return exactly one JSON object and no prose or multiple objects. A single Markdown code fence is allowed.",
    "Use the supplied taskId, invocationId and role unchanged.",
    "The object MUST match this shape:",
    buildResultShape(request),
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

export function buildAgentPrompt(request) {
  return {
    system: buildAgentSystemPrompt(request),
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

export function parseAgentResultText(text) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new AgentInvocationError("agent response is empty", {
      code: AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT,
    });
  }
  try {
    return JSON.parse(stripSingleCodeFence(text));
  } catch (cause) {
    throw new AgentInvocationError("agent response is not valid JSON", {
      code: AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT,
      cause,
    });
  }
}

function assertResultIdentity(result, request) {
  const issues = [];
  if (result.taskId !== request.taskId) issues.push("taskId does not match the request");
  if (result.invocationId !== request.invocationId) issues.push("invocationId does not match the request");
  if (result.role !== request.role) issues.push("role does not match the request");
  if (issues.length) {
    throw new AgentInvocationError(`agent result identity mismatch: ${issues.join("; ")}`, {
      code: AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT,
    });
  }
}

function responseText(parts) {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function promptBody(request, agent) {
  const prompt = buildAgentPrompt(request);
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

      let session;
      try {
        const created = await client.session.create({
          ...query,
          body: {
            ...(parentSessionID ? { parentID: parentSessionID } : {}),
            title: `WAM ${request.role} ${request.taskId} ${request.invocationId}`,
          },
        });
        if (created?.error) throw created.error;
        session = created?.data ?? created;
        if (!session?.id) throw new Error("session.create returned no session id");
      } catch (cause) {
        throw new AgentInvocationError("failed to create agent session", {
          code: AGENT_INVOCATION_ERROR_CODES.SESSION_CREATE_FAILED,
          cause,
        });
      }

      let response;
      try {
        response = await client.session.prompt({
          path: { id: session.id },
          ...query,
          body: promptBody(request, invocationAgent),
        });
        if (response?.error) throw response.error;
      } catch (cause) {
        throw new AgentInvocationError("failed to prompt agent session", {
          code: AGENT_INVOCATION_ERROR_CODES.PROMPT_FAILED,
          cause,
          sessionID: session.id,
        });
      }

      const data = response?.data ?? response;
      try {
        const result = parseAgentResultText(responseText(data?.parts));
        assertAgentResult(result);
        assertResultIdentity(result, request);
        return { result, metadata: { sessionID: session.id } };
      } catch (cause) {
        if (cause instanceof AgentInvocationError) {
          if (!cause.sessionID) cause.sessionID = session.id;
          throw cause;
        }
        throw new AgentInvocationError("agent returned an invalid result", {
          code: AGENT_INVOCATION_ERROR_CODES.INVALID_RESULT,
          cause,
          sessionID: session.id,
        });
      }
    },
  };
}
