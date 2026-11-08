import { FINDING_SEVERITIES } from "./role-contracts.js";

export class AgentContextError extends Error {
  constructor(issues) {
    super(`Agent context violation: ${issues.join("; ")}`);
    this.name = "AgentContextError";
    this.issues = issues;
  }
}

export const ROLE_CONTEXT_POLICY = Object.freeze({
  ANALYST: Object.freeze({
    limits: Object.freeze({ artifacts: 16, evidence: 16, constraints: 20, priorFindings: 0 }),
    findingSeverities: Object.freeze([]),
  }),
  ARCHITECT: Object.freeze({
    limits: Object.freeze({ artifacts: 12, evidence: 12, constraints: 20, priorFindings: 20 }),
    findingSeverities: Object.freeze([...FINDING_SEVERITIES]),
  }),
  BUILDER: Object.freeze({
    limits: Object.freeze({ artifacts: 20, evidence: 8, constraints: 20, priorFindings: 12 }),
    findingSeverities: Object.freeze(["HIGH", "CRITICAL"]),
  }),
  BACKEND_ENGINEER: Object.freeze({
    limits: Object.freeze({ artifacts: 20, evidence: 12, constraints: 20, priorFindings: 12 }),
    findingSeverities: Object.freeze(["HIGH", "CRITICAL"]),
  }),
  FRONTEND_ENGINEER: Object.freeze({
    limits: Object.freeze({ artifacts: 20, evidence: 12, constraints: 20, priorFindings: 12 }),
    findingSeverities: Object.freeze(["HIGH", "CRITICAL"]),
  }),
  UX_DESIGNER: Object.freeze({
    limits: Object.freeze({ artifacts: 20, evidence: 20, constraints: 20, priorFindings: 20 }),
    findingSeverities: Object.freeze([...FINDING_SEVERITIES]),
  }),
  REVIEWER: Object.freeze({
    limits: Object.freeze({ artifacts: 20, evidence: 30, constraints: 10, priorFindings: 30 }),
    findingSeverities: Object.freeze([...FINDING_SEVERITIES]),
  }),
});

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into",
  "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => !STOPWORDS.has(token)) ?? [];
}

function tokenSet(text) {
  return new Set(tokenize(text));
}

function score(text, queryTokens) {
  let hits = 0;
  for (const token of tokenSet(text)) {
    if (queryTokens.has(token)) hits += 1;
  }
  return hits;
}

function checkRefs(items, path, issues) {
  if (!Array.isArray(items)) {
    issues.push(`${path} must be an array`);
    return [];
  }
  const refs = [];
  const seen = new Set();
  items.forEach((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      issues.push(`${path}[${index}] must be a non-empty string`);
      return;
    }
    if (!seen.has(item)) {
      seen.add(item);
      refs.push(item);
    }
  });
  return refs;
}

function checkFindings(items, path, issues) {
  if (!Array.isArray(items)) {
    issues.push(`${path} must be an array`);
    return [];
  }
  const findings = [];
  const seen = new Set();
  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(item)) {
      issues.push(`${itemPath} must be an object`);
      return;
    }
    if (typeof item.id !== "string" || item.id.trim() === "") {
      issues.push(`${itemPath}.id must be a non-empty string`);
      return;
    }
    if (seen.has(item.id)) return;
    const finding = { id: item.id };
    if (typeof item.description !== "string" || item.description.trim() === "") {
      issues.push(`${itemPath}.description must be a non-empty string`);
    } else {
      finding.description = item.description;
    }
    if (!FINDING_SEVERITIES.includes(item.severity)) {
      issues.push(`${itemPath}.severity must be one of ${FINDING_SEVERITIES.join(", ")}`);
    } else {
      finding.severity = item.severity;
    }
    if (!Array.isArray(item.evidence)) {
      issues.push(`${itemPath}.evidence must be an array`);
    } else {
      const evidence = [];
      item.evidence.forEach((ref, refIndex) => {
        if (typeof ref !== "string" || ref.trim() === "") {
          issues.push(`${itemPath}.evidence[${refIndex}] must be a non-empty string`);
        } else {
          evidence.push(ref);
        }
      });
      finding.evidence = evidence;
    }
    if (item.criterionId !== undefined) {
      if (typeof item.criterionId !== "string" || item.criterionId.trim() === "") {
        issues.push(`${itemPath}.criterionId must be a non-empty string when present`);
      } else {
        finding.criterionId = item.criterionId;
      }
    }
    if (
      finding.description !== undefined &&
      finding.severity !== undefined &&
      finding.evidence !== undefined &&
      finding.evidence.length === item.evidence.length
    ) {
      seen.add(item.id);
      findings.push(finding);
    }
  });
  return findings;
}

function selectRefs(items, { limit, charBudget, queryTokens, ranked }) {
  const candidates = items.map((item, index) => ({
    item,
    index,
    score: ranked ? score(item, queryTokens) : 0,
  }));
  if (ranked) {
    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  }

  const selected = [];
  let usedChars = 0;
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (usedChars + candidate.item.length > charBudget) continue;
    selected.push(candidate.item);
    usedChars += candidate.item.length;
  }
  return { selected, omitted: items.length - selected.length, usedChars };
}

function selectFindings(findings, { limit, charBudget, queryTokens }) {
  const candidates = findings
    .map((finding, index) => ({
      finding,
      index,
      score: score(`${finding.description} ${finding.criterionId || ""}`, queryTokens),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = [];
  let usedChars = 0;
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    const length = JSON.stringify(candidate.finding).length;
    if (usedChars + length > charBudget) continue;
    selected.push(candidate.finding);
    usedChars += length;
  }
  return { selected, omitted: findings.length - selected.length, usedChars };
}

export function selectRoleContext({
  role,
  objective,
  artifacts = [],
  evidence = [],
  constraints = [],
  priorFindings = [],
  maxChars = 6000,
  maxCharsPerSource,
} = {}) {
  const issues = [];
  const policy = ROLE_CONTEXT_POLICY[role];
  if (!policy) issues.push(`unknown role: ${String(role)}`);
  if (typeof objective !== "string" || objective.trim() === "") {
    issues.push("objective must be a non-empty string");
  }
  if (!Number.isInteger(maxChars) || maxChars <= 0) {
    issues.push("maxChars must be a positive integer");
  }
  if (maxCharsPerSource !== undefined && (!Number.isInteger(maxCharsPerSource) || maxCharsPerSource <= 0)) {
    issues.push("maxCharsPerSource must be a positive integer when provided");
  }

  const artifactCandidates = checkRefs(artifacts, "artifacts", issues);
  const evidenceCandidates = checkRefs(evidence, "evidence", issues);
  const constraintCandidates = checkRefs(constraints, "constraints", issues);
  const findingCandidates = checkFindings(priorFindings, "priorFindings", issues);

  if (issues.length) throw new AgentContextError(issues);

  const queryTokens = tokenSet(objective);
  const sourceBudget = Math.min(
    maxCharsPerSource ?? Math.floor(maxChars / 4),
    Math.floor(maxChars / 4),
  );
  const allowedSeverities = new Set(policy.findingSeverities);
  const filteredFindings = findingCandidates.filter((finding) => allowedSeverities.has(finding.severity));

  const artifactSelection = selectRefs(artifactCandidates, {
    limit: policy.limits.artifacts,
    charBudget: sourceBudget,
    queryTokens,
    ranked: true,
  });
  const evidenceSelection = selectRefs(evidenceCandidates, {
    limit: policy.limits.evidence,
    charBudget: sourceBudget,
    queryTokens,
    ranked: true,
  });
  const constraintSelection = selectRefs(constraintCandidates, {
    limit: policy.limits.constraints,
    charBudget: sourceBudget,
    queryTokens,
    ranked: false,
  });
  const findingSelection = selectFindings(filteredFindings, {
    limit: policy.limits.priorFindings,
    charBudget: sourceBudget,
    queryTokens,
  });

  return {
    input: {
      artifacts: artifactSelection.selected,
      evidence: evidenceSelection.selected,
      constraints: constraintSelection.selected,
      priorFindings: findingSelection.selected,
    },
    metadata: {
      role,
      selected: {
        artifacts: artifactSelection.selected.length,
        evidence: evidenceSelection.selected.length,
        constraints: constraintSelection.selected.length,
        priorFindings: findingSelection.selected.length,
      },
      omitted: {
        artifacts: artifactSelection.omitted,
        evidence: evidenceSelection.omitted,
        constraints: constraintSelection.omitted,
        priorFindings: findingCandidates.length - findingSelection.selected.length,
      },
      budget: {
        maxChars,
        usedChars:
          artifactSelection.usedChars +
          evidenceSelection.usedChars +
          constraintSelection.usedChars +
          findingSelection.usedChars,
        maxCharsPerSource: sourceBudget,
      },
    },
  };
}
