export const TRACE_SCHEMA_VERSION = "1.0.0";
export const TOKEN_SOURCES = ["provider","tokenizer","trace","estimated"];
export const CONDITIONS = ["baseline","wam"];
export const MODES = ["trace-replay","real-model"];
export function validateTrace(trace) {
  const errors = [];
  if (!trace.schemaVersion) errors.push("Missing schemaVersion");
  if (!trace.runId || typeof trace.runId !== "string") errors.push("Missing or invalid runId");
  if (!trace.scenarioId || typeof trace.scenarioId !== "string") errors.push("Missing or invalid scenarioId");
  if (!CONDITIONS.includes(trace.condition)) errors.push(`Invalid condition: ${trace.condition}`);
  if (!MODES.includes(trace.mode)) errors.push(`Invalid mode: ${trace.mode}`);
  if (!trace.provenance || typeof trace.provenance.gitSha !== "string" || trace.provenance.gitSha === "HEAD" || trace.provenance.gitSha === "") errors.push("Invalid provenance gitSha");
  if (!trace.model || typeof trace.model.provider !== "string") errors.push("Invalid model");
  if (!Array.isArray(trace.turns) || trace.turns.length === 0) {
    errors.push("Invalid or empty turns");
  } else {
    trace.turns.forEach((t, i) => {
      if (typeof t.inputTokens !== "number" || typeof t.outputTokens !== "number" || t.inputTokens < 0 || t.outputTokens < 0) errors.push(`Turn ${i}: Invalid tokens`);
      if (t.inputTokens + t.outputTokens !== t.totalTokens) errors.push(`Turn ${i}: Tokens mismatch`);
      if (!TOKEN_SOURCES.includes(t.tokenSource)) errors.push(`Turn ${i}: Invalid tokenSource`);
    });
  }
  if (!trace.progress || typeof trace.progress.requirementsVerified !== "number") errors.push("Invalid progress");
  return { valid: errors.length === 0, errors };
}
export function assertTrace(trace) {
  const { valid, errors } = validateTrace(trace);
  if (!valid) throw new Error(`Invalid trace: ${errors.join(", ")}`);
}
