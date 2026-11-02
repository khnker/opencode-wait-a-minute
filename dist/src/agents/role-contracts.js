export const AGENT_ROLES = Object.freeze({
  ANALYST: "ANALYST",
  ARCHITECT: "ARCHITECT",
  BUILDER: "BUILDER",
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

export const ROLE_CAPABILITIES = Object.freeze({
  ANALYST: READONLY_CAPABILITIES,
  ARCHITECT: READONLY_CAPABILITIES,
  BUILDER: Object.freeze({
    readContext: true,
    investigate: true,
    proposeDecisions: false,
    modifyCode: true,
    modifyGlobalState: false,
    approveCompletion: false,
  }),
  REVIEWER: READONLY_CAPABILITIES,
});

export const ROLE_DEFINITIONS = Object.freeze({
  ANALYST: Object.freeze({
    responsibility: "Investigate, identify unknowns and produce findings",
    limits: Object.freeze([
      "Does not decide architecture",
      "Does not modify code",
      "Does not approve completion",
    ]),
  }),
  ARCHITECT: Object.freeze({
    responsibility: "Define strategy, technical decisions and scope",
    limits: Object.freeze([
      "Does not modify code",
      "Cannot approve its own strategy as external approval",
      "Does not approve completion",
    ]),
  }),
  BUILDER: Object.freeze({
    responsibility: "Implement the approved strategy",
    limits: Object.freeze([
      "Does not propose decisions",
      "Does not modify global task state",
      "Does not approve completion",
    ]),
  }),
  REVIEWER: Object.freeze({
    responsibility: "Independently evaluate changes and evidence",
    limits: Object.freeze([
      "Does not modify code",
      "Does not execute tests in this iteration",
      "Does not approve completion",
    ]),
  }),
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
    validateCollection(
      request.input.priorFindings,
      "input.priorFindings",
      issues,
      validateFinding
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
