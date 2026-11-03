import {
  RoleContractError,
  assertAgentResult,
  getRoleCapabilities,
} from "./role-contracts.js";
import { assertResultResources } from "./resource-policy.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateResultIdentity(result, request) {
  if (!isObject(result)) {
    return ["result must be an object"];
  }
  if (!isObject(request)) {
    return ["request must be an object"];
  }
  const issues = [];
  if (result.taskId !== request.taskId) {
    issues.push("taskId does not match the request");
  }
  if (result.invocationId !== request.invocationId) {
    issues.push("invocationId does not match the request");
  }
  if (result.role !== request.role) {
    issues.push("role does not match the request");
  }
  return issues;
}

export function assertResultIdentity(result, request) {
  const issues = validateResultIdentity(result, request);
  if (issues.length > 0) {
    throw new RoleContractError(issues);
  }
  return result;
}

export function normalizeAgentResult(result) {
  if (!isObject(result)) return result;
  let normalized = result;
  const copy = () => {
    if (normalized === result) normalized = { ...normalized };
    return normalized;
  };

  for (const key of [
    "findings",
    "decisions",
    "artifacts",
    "evidence",
    "openQuestions",
    "recommendations",
    "limitations",
  ]) {
    if (result[key] === undefined || result[key] === null) copy()[key] = [];
  }

  return normalized;
}

function validateResultCapabilities(result) {
  const issues = [];
  const capabilities = getRoleCapabilities(result.role);
  if (
    Array.isArray(result.decisions) &&
    result.decisions.length > 0 &&
    capabilities.proposeDecisions !== true
  ) {
    issues.push(`role ${result.role} cannot propose decisions`);
  }
  if (result.review !== undefined && result.role !== "REVIEWER") {
    issues.push("review is only allowed for the reviewer role");
  }
  return issues;
}

export function assertInvocationResult({
  request,
  invocation,
  resourceLimits,
} = {}) {
  if (!isObject(invocation)) {
    throw new RoleContractError(["invocation must be an object"]);
  }
  if (invocation.result === undefined || invocation.result === null) {
    throw new RoleContractError(["result is required"]);
  }
  const result = normalizeAgentResult(invocation.result);
  assertAgentResult(result);
  assertResultResources(result, resourceLimits);
  assertResultIdentity(result, request);
  const issues = validateResultCapabilities(result);
  if (issues.length > 0) {
    throw new RoleContractError(issues);
  }
  return { result, metadata: invocation.metadata ?? {} };
}
