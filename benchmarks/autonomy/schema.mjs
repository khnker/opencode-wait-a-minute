/**
 * Canonical run-record schema for the autonomy benchmark.
 *
 * Pure validators, no dependencies: a malformed record returns deterministic
 * errors instead of being silently accepted. Metrics are derived from persisted
 * events, so the record is the single source of truth for comparisons.
 */

export const BENCHMARK_SCHEMA = "wam.autonomy.benchmark/1";

export const BENCHMARK_CONFIG_IDS = Object.freeze([
  "opencode-no-wam",
  "wam-task-loop",
  "wam-task-loop-reviewer",
  "wam-full",
]);

export const BENCHMARK_TASK_KINDS = Object.freeze([
  "research",
  "implementation",
  "debugging",
  "refactoring",
  "review",
  "documentation",
  "unknown",
]);

export const DECISION_KEYS = Object.freeze([
  "continue",
  "verify",
  "replan",
  "waitUser",
  "block",
  "stopBudget",
  "stopStagnation",
]);

export const SEVERITY_KEYS = Object.freeze(["critical", "high", "medium", "low"]);

const TOP_LEVEL_KEYS = Object.freeze([
  "schema",
  "runId",
  "configId",
  "taskId",
  "taskKind",
  "model",
  "wam",
  "seed",
  "startedAt",
  "endedAt",
  "tokens",
  "iterations",
  "decisions",
  "outcome",
  "quality",
  "review",
  "context",
  "costPerOutcome",
]);

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegativeInt(value) {
  return Number.isInteger(value) && value >= 0;
}

function nonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function pushObjectErrors(errors, prefix, value, keys) {
  if (!isPlainObject(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  for (const key of keys) {
    if (!(key in value)) errors.push(`${prefix}.${key} is required`);
  }
}

function rejectUnknownKeys(errors, prefix, value, allowed) {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${prefix}.${key} is not part of the schema`);
  }
}

export function validateRunRecord(record) {
  const errors = [];
  if (!isPlainObject(record)) return { valid: false, errors: ["record must be an object"] };

  rejectUnknownKeys(errors, "record", record, TOP_LEVEL_KEYS);
  for (const key of TOP_LEVEL_KEYS) {
    if (!(key in record)) errors.push(`record.${key} is required`);
  }

  if (record.schema !== BENCHMARK_SCHEMA) {
    errors.push(`record.schema must be "${BENCHMARK_SCHEMA}"`);
  }
  if (!nonEmptyString(record.runId)) errors.push("record.runId must be a non-empty string");
  if (!BENCHMARK_CONFIG_IDS.includes(record.configId)) {
    errors.push(`record.configId must be one of: ${BENCHMARK_CONFIG_IDS.join(", ")}`);
  }
  if (!nonEmptyString(record.taskId)) errors.push("record.taskId must be a non-empty string");
  if (!BENCHMARK_TASK_KINDS.includes(record.taskKind)) {
    errors.push(`record.taskKind must be one of: ${BENCHMARK_TASK_KINDS.join(", ")}`);
  }
  if (!nonNegativeInt(record.seed)) errors.push("record.seed must be a non-negative integer");

  pushObjectErrors(errors, "record.model", record.model, ["id", "version"]);
  if (isPlainObject(record.model)) {
    if (!nonEmptyString(record.model.id)) errors.push("record.model.id must be a non-empty string");
    if (!nonEmptyString(record.model.version)) errors.push("record.model.version must be a non-empty string");
  }

  pushObjectErrors(errors, "record.wam", record.wam, ["version", "flags"]);
  if (isPlainObject(record.wam)) {
    if (!nonEmptyString(record.wam.version)) errors.push("record.wam.version must be a non-empty string");
    if (!isPlainObject(record.wam.flags)) errors.push("record.wam.flags must be an object");
  }

  const started = ISO_RE.test(record.startedAt || "");
  const ended = ISO_RE.test(record.endedAt || "");
  if (!started) errors.push("record.startedAt must be an ISO-8601 UTC timestamp");
  if (!ended) errors.push("record.endedAt must be an ISO-8601 UTC timestamp");
  if (started && ended && Date.parse(record.endedAt) < Date.parse(record.startedAt)) {
    errors.push("record.endedAt must not precede record.startedAt");
  }

  pushObjectErrors(errors, "record.tokens", record.tokens, ["input", "output", "cacheRead", "cacheWrite", "total"]);
  if (isPlainObject(record.tokens)) {
    for (const key of ["input", "output", "cacheRead", "cacheWrite", "total"]) {
      if (!nonNegativeInt(record.tokens[key])) errors.push(`record.tokens.${key} must be a non-negative integer`);
    }
    if (nonNegativeInt(record.tokens.input) && nonNegativeInt(record.tokens.output) && nonNegativeInt(record.tokens.total)) {
      if (record.tokens.total < record.tokens.input + record.tokens.output) {
        errors.push("record.tokens.total must be >= input + output");
      }
    }
  }

  if (!nonNegativeInt(record.iterations)) errors.push("record.iterations must be a non-negative integer");

  pushObjectErrors(errors, "record.decisions", record.decisions, DECISION_KEYS);
  if (isPlainObject(record.decisions)) {
    for (const key of DECISION_KEYS) {
      if (!nonNegativeInt(record.decisions[key])) errors.push(`record.decisions.${key} must be a non-negative integer`);
    }
  }

  pushObjectErrors(errors, "record.outcome", record.outcome, ["taskSuccess", "verifiedSuccess", "humanInterventions", "recovered", "replanned"]);
  if (isPlainObject(record.outcome)) {
    for (const key of ["taskSuccess", "verifiedSuccess", "recovered", "replanned"]) {
      if (typeof record.outcome[key] !== "boolean") errors.push(`record.outcome.${key} must be a boolean`);
    }
    if (!nonNegativeInt(record.outcome.humanInterventions)) {
      errors.push("record.outcome.humanInterventions must be a non-negative integer");
    }
  }

  pushObjectErrors(errors, "record.quality", record.quality, ["sufficient", "missing", "stale", "contradictions", "falseAcceptance", "falseBlock"]);
  if (isPlainObject(record.quality)) {
    for (const key of ["sufficient", "falseAcceptance", "falseBlock"]) {
      if (typeof record.quality[key] !== "boolean") errors.push(`record.quality.${key} must be a boolean`);
    }
    for (const key of ["missing", "stale", "contradictions"]) {
      if (!nonNegativeInt(record.quality[key])) errors.push(`record.quality.${key} must be a non-negative integer`);
    }
  }

  pushObjectErrors(errors, "record.review", record.review, ["findings", "defectsFound", "severity", "falseAcceptsPrevented"]);
  if (isPlainObject(record.review)) {
    for (const key of ["findings", "defectsFound", "falseAcceptsPrevented"]) {
      if (!nonNegativeInt(record.review[key])) errors.push(`record.review.${key} must be a non-negative integer`);
    }
    pushObjectErrors(errors, "record.review.severity", record.review.severity, SEVERITY_KEYS);
    if (isPlainObject(record.review.severity)) {
      for (const key of SEVERITY_KEYS) {
        if (!nonNegativeInt(record.review.severity[key])) {
          errors.push(`record.review.severity.${key} must be a non-negative integer`);
        }
      }
      rejectUnknownKeys(errors, "record.review.severity", record.review.severity, SEVERITY_KEYS);
    }
  }

  pushObjectErrors(errors, "record.context", record.context, ["injectedTokens", "relevantTokens", "relevanceScore"]);
  if (isPlainObject(record.context)) {
    for (const key of ["injectedTokens", "relevantTokens"]) {
      if (!nonNegativeInt(record.context[key])) errors.push(`record.context.${key} must be a non-negative integer`);
    }
    if (!nonNegativeNumber(record.context.relevanceScore)) {
      errors.push("record.context.relevanceScore must be a number between 0 and 1");
    } else if (record.context.relevanceScore > 1) {
      errors.push("record.context.relevanceScore must be a number between 0 and 1");
    }
    if (
      nonNegativeInt(record.context.relevantTokens) &&
      nonNegativeInt(record.context.injectedTokens) &&
      record.context.relevantTokens > record.context.injectedTokens
    ) {
      errors.push("record.context.relevantTokens must not exceed injectedTokens");
    }
  }

  if (!nonNegativeNumber(record.costPerOutcome)) {
    errors.push("record.costPerOutcome must be a non-negative number");
  }

  return { valid: errors.length === 0, errors };
}

export function assertRunRecord(record) {
  const result = validateRunRecord(record);
  if (!result.valid) {
    const error = new Error(`autonomy-benchmark: invalid run record\n- ${result.errors.join("\n- ")}`);
    error.name = "AutonomyBenchmarkSchemaError";
    error.errors = result.errors;
    throw error;
  }
  return record;
}
