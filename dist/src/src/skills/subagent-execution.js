// CH-06 subagent-driven skills: execution strategies, structured output contract,
// evidence attribution, scope enforcement, non-fabricating synthesis, partial errors.

export const EXECUTION_STRATEGIES = ["subagent", "direct", "parallel"];

export const STRUCTURED_FIELDS = ["claim", "action", "observation", "evidence"];

export function declareStrategy(skill = {}) {
  const strategy = skill.strategy || "direct";
  if (!EXECUTION_STRATEGIES.includes(strategy)) {
    return { ok: false, strategy: null, error: `unknown strategy: ${strategy}` };
  }
  return { ok: true, strategy, error: null };
}

export function validateSubagentOutput(output = {}) {
  const errors = [];
  if (typeof output !== "object" || output === null || typeof output.claim === "undefined" && typeof output.action === "undefined") {
    return { ok: false, errors: ["free-form output rejected: structured fields required"], output };
  }
  for (const field of STRUCTURED_FIELDS) {
    if (typeof output[field] === "undefined") errors.push(`missing field: ${field}`);
  }
  if (output.evidence && !Array.isArray(output.evidence)) errors.push("evidence must be an array");
  return { ok: errors.length === 0, errors, output };
}

export function checkScope(output = {}, scope = {}) {
  const allowed = scope.paths || [];
  const items = output.action && Array.isArray(output.action.paths) ? output.action.paths : [];
  const outOfScope = items.filter((p) => !allowed.some((a) => String(p).startsWith(a)));
  return { ok: outOfScope.length === 0, outOfScope };
}

export function attributeEvidence(items = [], subagentId) {
  return items.map((item) => ({ ...item, subagentId }));
}

export function recordFailure(subagentId, error) {
  return { subagentId, error: String(error), status: "FAILED" };
}

export function synthesize(results = []) {
  const evidence = [];
  const missing = [];
  const failed = [];
  const rejected = [];
  for (const result of results) {
    const id = result.id;
    if (result.error) {
      failed.push(recordFailure(id, result.error));
      continue;
    }
    const validation = validateSubagentOutput(result.output);
    if (!validation.ok) {
      rejected.push({ id, errors: validation.errors });
      continue;
    }
    const ev = Array.isArray(result.output.evidence) ? result.output.evidence : [];
    if (ev.length === 0) {
      missing.push(id);
      continue;
    }
    evidence.push(...attributeEvidence(ev, id));
  }
  return { evidence, missing, failed, rejected, ok: failed.length === 0 && rejected.length === 0 };
}
