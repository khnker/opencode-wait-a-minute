import { normalizeCompletion } from "./provider.mjs";

export function createProvider(cfg = {}) {
  const baseUrl = cfg.baseUrl ?? process.env.WAM_BENCH_BASE_URL;
  const apiKey = cfg.apiKey ?? process.env.WAM_BENCH_API_KEY;
  const model = cfg.model ?? process.env.WAM_BENCH_MODEL;
  const fetchImpl = cfg.fetchImpl ?? globalThis.fetch;
  const providerName = "openai-compatible";
  const timeoutMs = cfg.timeoutMs ?? Number(process.env.WAM_BENCH_TIMEOUT_MS ?? 120000);

  const estimateTokens = (text = "") => Math.ceil(String(text).length / 4);

  return {
    model,
    isConfigured: () => Boolean(baseUrl && apiKey && model),
    estimateTokens,
    complete: async ({ messages, maxTokens, temperature = 0, signal }) => {
      if (!baseUrl || !apiKey || !model) {
        throw new Error(
          "WAM bench provider not configured: provide baseUrl, apiKey and model (WAM_BENCH_BASE_URL, WAM_BENCH_API_KEY, WAM_BENCH_MODEL)"
        );
      }
      const timeoutSignal =
        Number.isFinite(timeoutMs) && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : null;
      const effectiveSignal =
        signal && timeoutSignal
          ? AbortSignal.any([signal, timeoutSignal])
          : signal ?? timeoutSignal;
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
        signal: effectiveSignal
      });
      if (!response.ok) {
        let body = "";
        try {
          body = await response.text();
        } catch {}
        throw new Error(`WAM bench provider request failed: status ${response.status} body=${body}`);
      }
      const data = await response.json();
      const choice = data.choices?.[0] ?? {};
      const message = choice.message ?? {};
      const content = typeof message.content === "string" ? message.content : "";
      const reasoning =
        typeof message.reasoning_content === "string"
          ? message.reasoning_content
          : typeof message.reasoning === "string"
            ? message.reasoning
            : "";
      const text = content.length > 0 ? content : reasoning;
      const promptText = messages.map((m) => m.content ?? "").join("");
      const raw = {
        text,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? estimateTokens(promptText),
          outputTokens: data.usage?.completion_tokens ?? estimateTokens(text)
        },
        finishReason: choice.finish_reason ?? null,
        upstreamModel: data.model ?? null
      };
      return { ...normalizeCompletion(raw, { model, provider: providerName }), finishReason: raw.finishReason, upstreamModel: raw.upstreamModel };
    }
  };
}