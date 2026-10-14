/**
 * Live harness for the prompt-policy experiment pack.
 *
 * Runs a prompt POLICY (system message) against a real LLM provider, one
 * scenario at a time, and returns the model's raw response text keyed by
 * scenario id so the EXISTING deterministic oracles (`deterministic.mjs`) can
 * grade it. This module never grades: it only produces observable outputs plus
 * an HONEST cost record.
 *
 * TASK SYNTHESIS: the prompt-eval suites carry `context` + `expectation`
 * (rubric) but no concrete task input. `buildTaskPrompt(scenario)` therefore
 * synthesizes a DETERMINISTIC user message from those two fields only, using a
 * fixed instruction header. Any change to the template changes every live
 * output, so the template lives here, documented, and is never randomized.
 *
 * COST HONESTY INVARIANT: token usage comes from the provider response and
 * latency from `performance.now()`. On a provider error we record the failure
 * (`executionFailures`) and an empty response — we NEVER fabricate tokens or
 * latency. `source` is `"mock"` when a mock provider is injected.
 *
 * TOOL-CALL / RETRY TELEMETRY: the provider may expose two OPTIONAL hooks:
 *
 *   - `recordToolCall(name, { ok = true, retry = false, durationMs = 0 } = {})`
 *     — called by the provider when it invokes a tool (read, write, edit,
 *     grep, bash, etc.). The harness stores it as
 *     `{ scenarioId, name, ok, retry, durationMs }`.
 *   - `recordRetry(reason = "unknown")`
 *     — called by the provider when it retries a provider call (429, 5xx,
 *     transient parse failure). Stored as `{ scenarioId, reason }`.
 *
 * Providers that don't implement these hooks still produce a valid run; the
 * missing arrays default to `[]`. Mock providers in tests typically implement
 * no-op hooks so the artifact stays byte-deterministic.
 *
 * DETERMINISM INVARIANT: given identical provider responses, `outputs`,
 * `perScenario` (usage, toolCalls, retries) and the experiment config/report
 * are byte-identical across repeats. Only `latencyMs` is inherently wall-clock.
 */

/** Fixed instruction header for every synthesized live task. */
const TASK_HEADER = [
  "You are the agent under evaluation. Respond to the scenario below.",
  "State the concrete actions you take (or would take) and the claims you make",
  "(completion, evidence, scope, simplification). Explicitly state what you",
  "did and did NOT verify. Do not ask clarifying questions.",
].join("\n");

/**
 * Synthesize the deterministic user message for a scenario.
 *
 * Template (fixed; only `scenario.context` and `scenario.expectation` vary):
 *   <TASK_HEADER>
 *
 *   # Scenario context
 *   <scenario.context>
 *
 *   # Expected behavior (rubric — do not restate verbatim)
 *   <scenario.expectation>
 *
 * @param {object} scenario
 * @returns {string}
 */
export function buildTaskPrompt(scenario) {
  if (!scenario || typeof scenario !== "object") {
    throw new TypeError("prompt-eval: buildTaskPrompt requires a scenario object");
  }
  const context = scenario.context ?? "";
  const expectation = scenario.expectation ?? "";
  return [
    TASK_HEADER,
    "",
    "# Scenario context",
    context,
    "",
    "# Expected behavior (rubric — do not restate verbatim)",
    expectation,
  ].join("\n");
}

function providerNameOf(provider, model) {
  if (provider && typeof provider.provider === "string" && provider.provider) {
    return provider.provider;
  }
  if (provider && typeof provider.name === "string" && provider.name) {
    return provider.name;
  }
  if (typeof model === "string" && model.startsWith("mock")) return "mock";
  return "openai-compatible";
}

/**
 * Run one prompt variant live over every scenario in a suite.
 *
 * @param {{ suite: object, variantId: string, policyText: string,
 *   provider: { model: string, complete: Function, isConfigured: Function, estimateTokens: Function },
 *   model?: string, temperature?: number, maxTokens?: number, trials?: number }} args
 * @returns {Promise<{ outputs: Record<string,string>, perScenario: object[], cost: object }>}
 */
export async function runLiveVariant({
  suite,
  variantId,
  policyText,
  provider,
  model,
  temperature = 0,
  maxTokens = 1024,
  trials = 1,
}) {
  if (!suite || !Array.isArray(suite.scenarios) || suite.scenarios.length === 0) {
    throw new TypeError("prompt-eval: runLiveVariant requires a suite with scenarios");
  }
  if (!provider || typeof provider.complete !== "function") {
    throw new TypeError("prompt-eval: runLiveVariant requires a provider with complete()");
  }
  const trialsPerScenario = Math.max(1, Number(trials) || 1);
  const modelName = model ?? provider.model;
  const providerName = providerNameOf(provider, modelName);
  const source = providerName === "mock" ? "mock" : "run";

  const outputs = {};
  const toolCalls = []; // [{ scenarioId, name, ok, retry, durationMs }]
  const retries = [];    // [{ scenarioId, reason }]
  const perScenario = [];

  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let latencySum = 0;
  let latencyN = 0;
  let executionFailures = 0;

  for (const scenario of suite.scenarios) {
    const texts = [];
    let sInput = 0;
    let sOutput = 0;
    let sTotal = 0;
    let sLatency = 0;
    let error;

    for (let t = 0; t < trialsPerScenario; t++) {
      const messages = [
        { role: "system", content: policyText },
        { role: "user", content: buildTaskPrompt(scenario) },
      ];
      const start = performance.now();
            let localToolCalls = [];
      let localRetries = [];
      const originalRecordToolCall = provider.recordToolCall || (() => {});
      const originalRecordRetry = provider.recordRetry || (() => {});
      // Monkey-patch provider to capture calls during this scenario
      provider.recordToolCall = (name, meta) => {
        localToolCalls.push({ name, ...meta });
        originalRecordToolCall.call(provider, name, meta);
      };
      provider.recordRetry = (reason) => {
        localRetries.push(reason);
        originalRecordRetry.call(provider, reason);
      };
      try {
        const result = await provider.complete({ messages, model: modelName, temperature, maxTokens });
        const usage = result?.usage ?? {};
        sInput += Number(usage.inputTokens) || 0;
        sOutput += Number(usage.outputTokens) || 0;
        sTotal += Number(usage.totalTokens) || 0;
        texts.push(typeof result?.text === "string" ? result.text : "");
      } catch (err) {
        executionFailures += 1;
        error = err instanceof Error ? err.message : String(err);
        // Honest accounting: no tokens invented, response recorded as empty.
        texts.push("");
            } finally {
        // Restore original provider methods
        provider.recordToolCall = originalRecordToolCall;
        provider.recordRetry = originalRecordRetry;
        // Aggregate into the run-level arrays
        localToolCalls.forEach(tc => toolCalls.push({ ...tc, scenarioId: scenario.id }));
        localRetries.forEach(reason => retries.push({ scenarioId: scenario.id, reason }));
      
        sLatency += performance.now() - start;
      }
    }

    outputs[scenario.id] = texts.join("\n");
    latencySum += sLatency;
    latencyN += trialsPerScenario;
    inputTokens += sInput;
    outputTokens += sOutput;
    totalTokens += sTotal;

    perScenario.push({
        toolCalls: toolCalls.filter(tc => tc.scenarioId === scenario.id),
        retries: retries.filter(r => r.scenarioId === scenario.id),
      
      scenarioId: scenario.id,
      usage: { inputTokens: sInput, outputTokens: sOutput, totalTokens: sTotal },
      latencyMs: sLatency,
      trials: trialsPerScenario,
      ...(error ? { error } : {}),
    });
  }

  const n = latencyN || suite.scenarios.length * trialsPerScenario;
  const cost = {
    tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
    latencyMs: { sum: latencySum, mean: n > 0 ? latencySum / n : 0, n },
    executionFailures,
    source,
    model: modelName,
    provider: providerName,
  };

        const toolCallTotals = {
        calls: toolCalls.length,
        ok: toolCalls.filter(tc => tc.ok).length,
        retry: toolCalls.filter(tc => tc.retry).length,
        byName: toolCalls.reduce((acc, tc) => {
          acc[tc.name] = (acc[tc.name] || 0) + 1;
          return acc;
        }, {}),
      };
      return { outputs, perScenario, cost: { ...cost, toolCalls, retries, toolCallTotals }, variantId };
}
