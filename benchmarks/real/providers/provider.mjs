/**
 * Real-provider adapter for the RC1 paired-LLM experiment harness.
 *
 * Wraps the existing normalized provider contract (benchmarks/providers/provider.mjs)
 * and extends it with the telemetry fields the experiment protocol requires:
 *   - cachedInputTokens  provider-side prompt caching, tracked SEPARATELY from
 *                        WAM algorithmic input-token reduction
 *   - latencyMs          wall-clock latency of the completion call
 *   - finishReason       provider-reported stop reason
 *   - toolCalls          provider-reported tool calls (optional)
 *
 * Exactly one HTTP request per `complete()` call. `fetchImpl` is injectable so
 * tests never touch the network.
 */

import { normalizeCompletion } from "../../providers/provider.mjs";

/**
 * @typedef {Object} RealProviderConfig
 * @property {"openai-compatible"|"mock"} [kind]
 * @property {string} [baseUrl]
 * @property {string} [apiKey]
 * @property {string} [model]
 * @property {function} [fetchImpl]
 * @property {function} [now] - returns epoch ms, defaults to Date.now
 */

/**
 * @typedef {Object} RealProvider
 * @property {string} model
 * @property {() => boolean} isConfigured
 * @property {(text?: string) => number} estimateTokens
 * @property {(req: Object) => Promise<Object>} complete
 */

/** Provider-side cached prompt tokens, isolated from WAM input reduction. */
function extractCachedTokens(usage) {
  const n = Number(usage?.prompt_tokens_details?.cached_tokens);
  return Number.isFinite(n) ? n : 0;
}

/** Provider-reported tool calls, or undefined when none were emitted. */
function extractToolCalls(data) {
  const calls = data?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls) || calls.length === 0) return undefined;
  return calls.map((call) => ({
    id: call.id,
    type: call.type ?? "function",
    function: call.function
  }));
}

/** Mock adapter: deterministic, no network, same extended contract. */
function createMockAdapter(model, now) {
  const estimateTokens = (text = "") => Math.ceil(String(text).length / 4);
  const resolvedModel = model ?? "mock/dry-run";

  return {
    model: resolvedModel,
    isConfigured: () => true,
    estimateTokens,
    complete: async ({ messages, responses, usage }) => {
      const start = now();
      const promptText = messages.map((m) => m.content ?? "").join("");
      const text = `[mock-response] ${promptText.length} chars`;
      const result = normalizeCompletion(
        { text, usage: { inputTokens: estimateTokens(promptText), outputTokens: estimateTokens(text) } },
        { model: resolvedModel, provider: "mock" }
      );
      return {
        ...result,
        usage: { ...result.usage, cachedInputTokens: 0 },
        latencyMs: now() - start,
        finishReason: "stop",
        toolCalls: undefined,
        responses,
        rawUsage: usage
      };
    }
  };
}

export function createRealProvider(config) {
  const {
    kind = "openai-compatible",
    baseUrl = process.env.WAM_BENCH_BASE_URL,
    apiKey = process.env.WAM_BENCH_API_KEY,
    model = process.env.WAM_BENCH_MODEL,
    fetchImpl = globalThis.fetch,
    now = () => Date.now()
  } = config ?? {};

  if (kind === "mock") return createMockAdapter(model, now);

  const providerName = "openai-compatible";
  const estimateTokens = (text = "") => Math.ceil(String(text).length / 4);
  const isConfigured = () => Boolean(baseUrl && apiKey && model);

  return {
    model,
    isConfigured,
    estimateTokens,

    complete: async ({ messages, maxTokens, temperature = 0, signal, responses, usage }) => {
      if (!isConfigured()) {
        throw new Error(
          "WAM bench provider not configured: provide baseUrl, apiKey and model (WAM_BENCH_BASE_URL, WAM_BENCH_API_KEY, WAM_BENCH_MODEL)"
        );
      }

      const start = now();
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
        signal
      });

      if (!response.ok) {
        let body = "";
        try {
          body = await response.text();
        } catch {}
        throw new Error(
          `WAM bench provider request failed: status ${response.status} body=${body}`
        );
      }

      const data = await response.json();
      const latencyMs = now() - start;

      const text = data.choices?.[0]?.message?.content ?? "";
      const promptText = messages.map((m) => m.content ?? "").join("");
      const inputTokens = data.usage?.prompt_tokens ?? estimateTokens(promptText);
      const outputTokens = data.usage?.completion_tokens ?? estimateTokens(text);

      const result = normalizeCompletion(
        { text, usage: { inputTokens, outputTokens } },
        { model, provider: providerName }
      );

      return {
        ...result,
        usage: { ...result.usage, cachedInputTokens: extractCachedTokens(data.usage) },
        latencyMs,
        finishReason: data.choices?.[0]?.finish_reason ?? null,
        toolCalls: extractToolCalls(data),
        responses,
        rawUsage: usage
      };
    }
  };
}
