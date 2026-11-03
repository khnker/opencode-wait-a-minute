import { RoleContractError } from "./role-contracts.js";

export const AGENT_RESOURCE_LIMITS = Object.freeze({
  maxResultBytes: 65536,
  maxFindings: 100,
  maxDecisions: 50,
  maxArtifacts: 50,
  maxEvidence: 100,
  maxInvocations: 16,
  maxInvocationMs: 300000,
});

const LIMIT_KEYS = Object.freeze(Object.keys(AGENT_RESOURCE_LIMITS));
const POSITIVE_LIMITS = Object.freeze(
  LIMIT_KEYS.filter((key) => key !== "maxInvocationMs"),
);
const COLLECTION_LIMITS = Object.freeze([
  ["findings", "maxFindings"],
  ["decisions", "maxDecisions"],
  ["artifacts", "maxArtifacts"],
  ["evidence", "maxEvidence"],
]);

export function resolveResourceLimits(overrides = {}) {
  if (overrides === undefined || overrides === null) {
    overrides = {};
  }
  if (typeof overrides !== "object" || Array.isArray(overrides)) {
    throw new RoleContractError(["resourceLimits must be an object"]);
  }

  const issues = [];
  for (const key of Object.keys(overrides)) {
    if (!LIMIT_KEYS.includes(key)) {
      issues.push(`resourceLimits.${key} is not a supported limit`);
    }
  }

  const merged = { ...AGENT_RESOURCE_LIMITS };
  for (const key of POSITIVE_LIMITS) {
    if (!(key in overrides)) continue;
    const value = overrides[key];
    if (!Number.isInteger(value) || value <= 0) {
      issues.push(`resourceLimits.${key} must be a positive integer`);
      continue;
    }
    merged[key] = value;
  }

  if ("maxInvocationMs" in overrides) {
    const value = overrides.maxInvocationMs;
    if (!Number.isInteger(value) || value < 0) {
      issues.push(
        "resourceLimits.maxInvocationMs must be a non-negative integer",
      );
    } else {
      merged.maxInvocationMs = value;
    }
  }

  if (issues.length > 0) {
    throw new RoleContractError(issues);
  }
  return Object.freeze(merged);
}

export function assertResultResources(result, limits = AGENT_RESOURCE_LIMITS) {
  const issues = [];

  let serialized;
  try {
    serialized = JSON.stringify(result);
  } catch {
    issues.push("result must be JSON serializable");
  }
  if (serialized !== undefined) {
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes > limits.maxResultBytes) {
      issues.push(
        `result exceeds maxResultBytes (${bytes} > ${limits.maxResultBytes})`,
      );
    }
  }

  for (const [field, limitKey] of COLLECTION_LIMITS) {
    const value = result?.[field];
    if (!Array.isArray(value)) continue;
    const limit = limits[limitKey];
    if (value.length > limit) {
      issues.push(
        `result.${field} exceeds ${limitKey} (${value.length} > ${limit})`,
      );
    }
  }

  if (issues.length > 0) {
    throw new RoleContractError(issues);
  }
  return result;
}
