export const AGENT_ROLES = Object.freeze({
  ANALYST: "ANALYST",
  ARCHITECT: "ARCHITECT",
  BUILDER: "BUILDER",
  BACKEND_ENGINEER: "BACKEND_ENGINEER",
  FRONTEND_ENGINEER: "FRONTEND_ENGINEER",
  UX_DESIGNER: "UX_DESIGNER",
  REVIEWER: "REVIEWER",
});

export const AGENT_ROLE_VALUES = Object.freeze(Object.values(AGENT_ROLES));

export const AGENT_STATUSES = Object.freeze([
  "COMPLETED",
  "BLOCKED",
  "NEEDS_INPUT",
  "FAILED",
]);

export const FINDING_SEVERITIES = Object.freeze([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const REVIEW_VERDICTS = Object.freeze([
  "ACCEPTED",
  "REVISION_REQUIRED",
  "REPLAN_REQUIRED",
  "BLOCKED",
]);

const READONLY_CAPABILITIES = Object.freeze({
  readContext: true,
  investigate: true,
  proposeDecisions: true,
  modifyCode: false,
  modifyGlobalState: false,
  approveCompletion: false,
});

const MUTATING_CAPABILITIES = Object.freeze({
  readContext: true,
  investigate: true,
  proposeDecisions: false,
  modifyCode: true,
  modifyGlobalState: false,
  approveCompletion: false,
});

export const ROLE_CAPABILITIES = Object.freeze({
  ANALYST: READONLY_CAPABILITIES,
  ARCHITECT: READONLY_CAPABILITIES,
  BUILDER: MUTATING_CAPABILITIES,
  BACKEND_ENGINEER: MUTATING_CAPABILITIES,
  FRONTEND_ENGINEER: MUTATING_CAPABILITIES,
  UX_DESIGNER: READONLY_CAPABILITIES,
  REVIEWER: READONLY_CAPABILITIES,
});

export const ROLE_DEFINITIONS = Object.freeze({
  ANALYST: Object.freeze({
    responsibility: "Investigate, identify unknowns and produce findings",
    skills: Object.freeze([
      "github-awesome-copilot-acquire-codebase-knowledge",
      "github-awesome-copilot-context-map",
      "diagnosing-bugs",
    ]),
    limits: Object.freeze([
      "Does not decide architecture",
      "Does not modify code",
      "Does not approve completion",
    ]),
  }),
  ARCHITECT: Object.freeze({
    responsibility: "Define strategy, technical decisions and scope",
    skills: Object.freeze([
      "codebase-design",
      "design-contract",
      "github-awesome-copilot-create-implementation-plan",
    ]),
    limits: Object.freeze([
      "Does not modify code",
      "Cannot approve its own strategy as external approval",
      "Does not approve completion",
    ]),
  }),
  BUILDER: Object.freeze({
    responsibility: "Implement the approved strategy",
    skills: Object.freeze(["craftsman", "tdd", "verify"]),
    limits: Object.freeze([
      "Does not propose decisions",
      "Does not modify global task state",
      "Does not approve completion",
    ]),
  }),
  BACKEND_ENGINEER: Object.freeze({
    responsibility: "Implement the approved backend strategy",
    layer: "backend",
    focus: "APIs, data integrity, migrations and server-side behavior",
    skills: Object.freeze(["nestjs-best-practices", "backend-integrity", "tdd", "craftsman", "verify"]),
    limits: Object.freeze([
      "Does not modify frontend or UX layers",
      "Does not propose decisions",
      "Does not modify global task state",
      "Does not approve completion",
    ]),
  }),
  FRONTEND_ENGINEER: Object.freeze({
    responsibility: "Implement the approved frontend strategy",
    layer: "frontend",
    focus: "components, state, accessibility and frontend performance",
    skills: Object.freeze(["angular-developer", "frontend-boundary-protection", "unslop", "web-design", "tdd", "craftsman"]),
    limits: Object.freeze([
      "Does not modify backend or infrastructure layers",
      "Does not propose decisions",
      "Does not modify global task state",
      "Does not approve completion",
    ]),
  }),
  UX_DESIGNER: Object.freeze({
    responsibility: "Evaluate UX, accessibility and design-system consistency",
    layer: "frontend",
    focus: "interaction design, usability, visual hierarchy and accessibility",
    skills: Object.freeze(["design-system", "design-critique", "visual-review", "unslop", "no-slop-ui", "web-design"]),
    limits: Object.freeze([
      "Does not modify code",
      "Does not override an ARCHITECT decision without evidence",
      "Does not approve completion",
    ]),
  }),
  REVIEWER: Object.freeze({
    responsibility: "Independently evaluate changes and evidence",
    skills: Object.freeze([
      "senior-refactor-reviewer",
      "github-awesome-copilot-code-review",
      "verify",
    ]),
    limits: Object.freeze([
      "Does not modify code",
      "Does not execute tests in this iteration",
      "Does not approve completion",
    ]),
  }),
});

/** Canonical user-visible stage for each role in the agent loop. */
export const ROLE_STAGES = Object.freeze({
  ANALYST: Object.freeze({ index: 1, total: 4, label: "analysis" }),
  ARCHITECT: Object.freeze({ index: 2, total: 4, label: "strategy" }),
  BUILDER: Object.freeze({ index: 3, total: 4, label: "implementation" }),
  BACKEND_ENGINEER: Object.freeze({ index: 3, total: 4, label: "backend implementation" }),
  FRONTEND_ENGINEER: Object.freeze({ index: 3, total: 4, label: "frontend implementation" }),
  UX_DESIGNER: Object.freeze({ index: 2, total: 4, label: "design strategy" }),
  REVIEWER: Object.freeze({ index: 4, total: 4, label: "review" }),
});

export function getRoleStage(role) {
  return ROLE_STAGES[role] || null;
}

/** Roles allowed to mutate code during implementation. */
export const BUILDER_ROLES = Object.freeze([
  AGENT_ROLES.BUILDER,
  AGENT_ROLES.BACKEND_ENGINEER,
  AGENT_ROLES.FRONTEND_ENGINEER,
]);

export function isBuilderRole(role) {
  return BUILDER_ROLES.includes(role);
}

/** Pick the implementation role for a declared layer. */
export function builderRoleForLayer(layer) {
  if (layer === "backend") return AGENT_ROLES.BACKEND_ENGINEER;
  if (layer === "frontend") return AGENT_ROLES.FRONTEND_ENGINEER;
  return AGENT_ROLES.BUILDER;
}

export const REVIEW_ARTIFACT_LIMITS = Object.freeze({
  maxEntries: 8,
  maxContentChars: 20000,
});

const REQUEST_KEYS = Object.freeze([
  "taskId",
  "invocationId",
  "role",
  "objective",
  "acceptanceCriteria",
  "input",
  "expectedOutput",
]);

const REQUEST_INPUT_KEYS = Object.freeze([
  "artifacts",
  "evidence",
  "constraints",
  "priorFindings",
  "reviewArtifacts",
  "approvedStrategy",
]);

const RESULT_KEYS = Object.freeze([
  "taskId",
  "invocationId",
  "role",
  "status",
  "summary",
  "findings",
  "decisions",
  "artifacts",
  "evidence",
  "openQuestions",
  "recommendations",
  "limitations",
  "review",
]);

export class RoleContractError extends Error {
  constructor(issues) {
    const list = Array.isArray(issues) ? issues : [String(issues)];
    super(`Agent role contract violation: ${list.join("; ")}`);
    this.name = "RoleContractError";
    this.issues = Object.freeze([...list]);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function checkUnknownKeys(value, allowed, path, issues) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      issues.push(`${path}${key} is not part of the contract`);
    }
  }
}

function checkId(item, path, issues) {
  if (!isNonEmptyString(item.id)) {
    issues.push(`${path}.id must be a non-empty string`);
  }
}

function checkNonEmptyField(item, field, path, issues) {
  if (!isNonEmptyString(item[field])) {
    issues.push(`${path}.${field} must be a non-empty string`);
  }
}

const APPROVED_STRATEGY_KEYS = Object.freeze([
  "version",
  "source",
  "approvedBy",
  "decisions",
  "constraints",
]);

const APPROVED_STRATEGY_DECISION_KEYS = Object.freeze([
  "id",
  "description",
  "rationale",
]);

// Local structural check to avoid importing approved-strategy.js (circular).
function checkApprovedStrategy(value, path, issues) {
  if (!isObject(value)) {
    issues.push(`${path} must be an object`);
    return;
  }
  checkUnknownKeys(value, APPROVED_STRATEGY_KEYS, `${path}.`, issues);
  if (value.version !== 1) {
    issues.push(`${path}.version must be 1`);
  }
  if (value.source !== "ARCHITECT") {
    issues.push(`${path}.source must be "ARCHITECT"`);
  }
  if (value.approvedBy !== "ORCHESTRATOR") {
    issues.push(`${path}.approvedBy must be "ORCHESTRATOR"`);
  }
  if (!Array.isArray(value.decisions)) {
    issues.push(`${path}.decisions must be an array`);
  } else {
    value.decisions.forEach((decision, index) => {
      const decisionPath = `${path}.decisions[${index}]`;
      if (!isObject(decision)) {
        issues.push(`${decisionPath} must be an object`);
        return;
      }
      checkUnknownKeys(
        decision,
        APPROVED_STRATEGY_DECISION_KEYS,
        `${decisionPath}.`,
        issues
      );
      for (const field of APPROVED_STRATEGY_DECISION_KEYS) {
        if (!isNonEmptyString(decision[field])) {
          issues.push(`${decisionPath}.${field} must be a non-empty string`);
        }
      }
    });
  }
  checkStringArray(value.constraints, `${path}.constraints`, issues);
}

function checkStringArray(value, path, issues, { nonEmpty = false } = {}) {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array`);
    return;
  }
  if (nonEmpty && value.length === 0) {
    issues.push(`${path} must not be empty`);
  }
  value.forEach((entry, index) => {
    if (!isNonEmptyString(entry)) {
      issues.push(`${path}[${index}] must be a non-empty string`);
    }
  });
}

function checkUniqueIds(items, path, issues) {
  const seen = new Set();
  items.forEach((item, index) => {
    if (!isObject(item) || !isNonEmptyString(item.id)) return;
    if (seen.has(item.id)) {
      issues.push(`${path}[${index}].id duplicates ${item.id}`);
    }
    seen.add(item.id);
  });
}

function validateFinding(item, path, issues) {
  checkId(item, path, issues);
  checkNonEmptyField(item, "description", path, issues);
  if (!FINDING_SEVERITIES.includes(item.severity)) {
    issues.push(
      `${path}.severity must be one of ${FINDING_SEVERITIES.join(", ")}`
    );
  }
  checkStringArray(item.evidence, `${path}.evidence`, issues);
  if (item.criterionId !== undefined && !isNonEmptyString(item.criterionId)) {
    issues.push(`${path}.criterionId must be a non-empty string when present`);
  }
}

function validateDecision(item, path, issues) {
  checkId(item, path, issues);
  checkNonEmptyField(item, "description", path, issues);
  checkNonEmptyField(item, "rationale", path, issues);
}

function validateReviewArtifacts(value, path, issues) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array`);
    return;
  }
  if (value.length > REVIEW_ARTIFACT_LIMITS.maxEntries) {
    issues.push(`${path} must contain at most ${REVIEW_ARTIFACT_LIMITS.maxEntries} entries`);
  }
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(item)) {
      issues.push(`${itemPath} must be an object`);
      return;
    }
    if (!isNonEmptyString(item.ref)) {
      issues.push(`${itemPath}.ref must be a non-empty string`);
    }
    if (!isNonEmptyString(item.content)) {
      issues.push(`${itemPath}.content must be a non-empty string`);
    } else if (item.content.length > REVIEW_ARTIFACT_LIMITS.maxContentChars) {
      issues.push(
        `${itemPath}.content must contain at most ${REVIEW_ARTIFACT_LIMITS.maxContentChars} characters`
      );
    }
  });
}

function validateCollection(items, path, issues, validateItem) {
  if (!Array.isArray(items)) {
    issues.push(`${path} must be an array`);
    return;
  }
  checkUniqueIds(items, path, issues);
  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(item)) {
      issues.push(`${itemPath} must be an object`);
      return;
    }
    validateItem(item, itemPath, issues);
  });
}

function validateAcceptanceCriterion(item, path, issues) {
  checkId(item, path, issues);
  checkNonEmptyField(item, "description", path, issues);
  if (typeof item.mandatory !== "boolean") {
    issues.push(`${path}.mandatory must be a boolean`);
  }
  if (
    item.evidenceRequirements !== undefined &&
    !isObject(item.evidenceRequirements)
  ) {
    issues.push(`${path}.evidenceRequirements must be an object when present`);
  }
}

function validateReviewFinding(item, path, issues) {
  if (item.criterionId !== undefined && !isNonEmptyString(item.criterionId)) {
    issues.push(`${path}.criterionId must be a non-empty string when present`);
  }
  if (!FINDING_SEVERITIES.includes(item.severity)) {
    issues.push(
      `${path}.severity must be one of ${FINDING_SEVERITIES.join(", ")}`
    );
  }
  checkNonEmptyField(item, "description", path, issues);
  checkStringArray(item.evidence, `${path}.evidence`, issues, { nonEmpty: true });
  checkNonEmptyField(item, "correctiveAction", path, issues);
}

function validateReview(review, status, issues) {
  if (!isObject(review)) {
    issues.push("review must be an object");
    return;
  }
  checkUnknownKeys(review, ["verdict", "findings", "limitations"], "review.", issues);
  if (!REVIEW_VERDICTS.includes(review.verdict)) {
    issues.push(`review.verdict must be one of ${REVIEW_VERDICTS.join(", ")}`);
  }
  if (!Array.isArray(review.findings)) {
    issues.push("review.findings must be an array");
  } else {
    review.findings.forEach((finding, index) => {
      const path = `review.findings[${index}]`;
      if (!isObject(finding)) {
        issues.push(`${path} must be an object`);
        return;
      }
      validateReviewFinding(finding, path, issues);
    });
    if (
      (review.verdict === "REVISION_REQUIRED" ||
        review.verdict === "REPLAN_REQUIRED") &&
      review.findings.length === 0
    ) {
      issues.push(`review.findings must not be empty for ${review.verdict}`);
    }
  }
  checkStringArray(review.limitations, "review.limitations", issues);

  if (status === "COMPLETED" && review.verdict === "BLOCKED") {
    issues.push("review.verdict BLOCKED requires status BLOCKED");
  }
  if (status === "BLOCKED" && review.verdict !== "BLOCKED") {
    issues.push("status BLOCKED requires review.verdict BLOCKED");
  }
}

export function validateAgentRequest(request) {
  const issues = [];
  if (!isObject(request)) {
    return { valid: false, issues: ["request must be an object"] };
  }
  checkUnknownKeys(request, REQUEST_KEYS, "", issues);

  if (!isNonEmptyString(request.taskId)) {
    issues.push("taskId must be a non-empty string");
  }
  if (!isNonEmptyString(request.invocationId)) {
    issues.push("invocationId must be a non-empty string");
  }
  if (!AGENT_ROLE_VALUES.includes(request.role)) {
    issues.push(`unknown role: ${String(request.role)}`);
  }
  if (!isNonEmptyString(request.objective)) {
    issues.push("objective must be a non-empty string");
  }

  if (!Array.isArray(request.acceptanceCriteria) || request.acceptanceCriteria.length === 0) {
    issues.push("acceptanceCriteria must be a non-empty array");
  } else {
    checkUniqueIds(request.acceptanceCriteria, "acceptanceCriteria", issues);
    request.acceptanceCriteria.forEach((criterion, index) => {
      const path = `acceptanceCriteria[${index}]`;
      if (!isObject(criterion)) {
        issues.push(`${path} must be an object`);
        return;
      }
      validateAcceptanceCriterion(criterion, path, issues);
    });
  }

  if (!isObject(request.input)) {
    issues.push("input must be an object");
  } else {
    checkUnknownKeys(request.input, REQUEST_INPUT_KEYS, "input.", issues);
    checkStringArray(request.input.artifacts, "input.artifacts", issues);
    checkStringArray(request.input.evidence, "input.evidence", issues);
    checkStringArray(request.input.constraints, "input.constraints", issues);
    if (request.input.approvedStrategy !== undefined) {
      checkApprovedStrategy(
        request.input.approvedStrategy,
        "input.approvedStrategy",
        issues
      );
    }
    validateCollection(
      request.input.priorFindings,
      "input.priorFindings",
      issues,
      validateFinding
    );
    validateReviewArtifacts(
      request.input.reviewArtifacts,
      "input.reviewArtifacts",
      issues
    );
  }

  checkStringArray(request.expectedOutput, "expectedOutput", issues, {
    nonEmpty: true,
  });

  return { valid: issues.length === 0, issues };
}

export function assertAgentRequest(request) {
  const { valid, issues } = validateAgentRequest(request);
  if (!valid) {
    throw new RoleContractError(issues);
  }
  return request;
}

export function validateAgentResult(result) {
  const issues = [];
  if (!isObject(result)) {
    return { valid: false, issues: ["result must be an object"] };
  }
  checkUnknownKeys(result, RESULT_KEYS, "", issues);

  if (!isNonEmptyString(result.taskId)) {
    issues.push("taskId must be a non-empty string");
  }
  if (!isNonEmptyString(result.invocationId)) {
    issues.push("invocationId must be a non-empty string");
  }
  if (!AGENT_ROLE_VALUES.includes(result.role)) {
    issues.push(`unknown role: ${String(result.role)}`);
  }
  if (!AGENT_STATUSES.includes(result.status)) {
    issues.push(`status must be one of ${AGENT_STATUSES.join(", ")}`);
  }
  if (!isNonEmptyString(result.summary)) {
    issues.push("summary must be a non-empty string");
  }

  validateCollection(result.findings, "findings", issues, validateFinding);
  validateCollection(result.decisions, "decisions", issues, validateDecision);
  checkStringArray(result.artifacts, "artifacts", issues);
  checkStringArray(result.evidence, "evidence", issues);
  checkStringArray(result.openQuestions, "openQuestions", issues);
  checkStringArray(result.recommendations, "recommendations", issues);
  checkStringArray(result.limitations, "limitations", issues);

  if (result.role === AGENT_ROLES.REVIEWER) {
    if (result.status === "FAILED") {
      if (result.review !== undefined) {
        validateReview(result.review, result.status, issues);
      }
    } else if (result.review === undefined) {
      issues.push("review is required for reviewer results unless status FAILED");
    } else {
      validateReview(result.review, result.status, issues);
    }
  } else if (result.review !== undefined) {
    issues.push("review is only allowed for the reviewer role");
  }

  return { valid: issues.length === 0, issues };
}

export function assertAgentResult(result) {
  const { valid, issues } = validateAgentResult(result);
  if (!valid) {
    throw new RoleContractError(issues);
  }
  return result;
}

export function getRoleCapabilities(role) {
  const capabilities = ROLE_CAPABILITIES[role];
  if (!capabilities) {
    throw new RoleContractError([`unknown role: ${String(role)}`]);
  }
  return capabilities;
}

export function getRoleDefinition(role) {
  const definition = ROLE_DEFINITIONS[role];
  if (!definition) {
    throw new RoleContractError([`unknown role: ${String(role)}`]);
  }
  return definition;
}
