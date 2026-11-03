import { RoleContractError } from "./role-contracts.js";

export const APPROVED_STRATEGY_VERSION = 1;

const STRATEGY_KEYS = Object.freeze([
  "version",
  "source",
  "approvedBy",
  "decisions",
  "constraints",
]);

const DECISION_KEYS = Object.freeze(["id", "description", "rationale"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function collectIssues(strategy) {
  const issues = [];
  if (!isObject(strategy)) {
    return ["approved strategy must be an object"];
  }

  for (const key of Object.keys(strategy)) {
    if (!STRATEGY_KEYS.includes(key)) {
      issues.push(`${key} is not part of the approved strategy contract`);
    }
  }

  if (strategy.version !== APPROVED_STRATEGY_VERSION) {
    issues.push(`version must be ${APPROVED_STRATEGY_VERSION}`);
  }
  if (strategy.source !== "ARCHITECT") {
    issues.push('source must be "ARCHITECT"');
  }
  if (strategy.approvedBy !== "ORCHESTRATOR") {
    issues.push('approvedBy must be "ORCHESTRATOR"');
  }

  if (!Array.isArray(strategy.decisions)) {
    issues.push("decisions must be an array");
  } else {
    const seen = new Set();
    strategy.decisions.forEach((decision, index) => {
      const path = `decisions[${index}]`;
      if (!isObject(decision)) {
        issues.push(`${path} must be an object`);
        return;
      }
      for (const key of Object.keys(decision)) {
        if (!DECISION_KEYS.includes(key)) {
          issues.push(`${path}.${key} is not part of the contract`);
        }
      }
      for (const field of DECISION_KEYS) {
        if (!isNonEmptyString(decision[field])) {
          issues.push(`${path}.${field} must be a non-empty string`);
        }
      }
      if (isNonEmptyString(decision.id)) {
        if (seen.has(decision.id)) {
          issues.push(`${path}.id duplicates ${decision.id}`);
        }
        seen.add(decision.id);
      }
    });
  }

  if (!Array.isArray(strategy.constraints)) {
    issues.push("constraints must be an array");
  } else {
    strategy.constraints.forEach((constraint, index) => {
      if (!isNonEmptyString(constraint)) {
        issues.push(`constraints[${index}] must be a non-empty string`);
      }
    });
  }

  return issues;
}

export function assertApprovedStrategy(strategy) {
  const issues = collectIssues(strategy);
  if (issues.length) {
    throw new RoleContractError(issues);
  }
  return strategy;
}

export function buildApprovedStrategy({ decisions = [], constraints = [] } = {}) {
  const strategy = {
    version: APPROVED_STRATEGY_VERSION,
    source: "ARCHITECT",
    approvedBy: "ORCHESTRATOR",
    decisions: Array.isArray(decisions)
      ? decisions.map((decision) =>
          Object.freeze({
            id: decision.id,
            description: decision.description,
            rationale: decision.rationale,
          })
        )
      : decisions,
    constraints: Array.isArray(constraints) ? [...constraints] : constraints,
  };
  assertApprovedStrategy(strategy);
  return Object.freeze({
    ...strategy,
    decisions: Object.freeze(strategy.decisions),
    constraints: Object.freeze(strategy.constraints),
  });
}
