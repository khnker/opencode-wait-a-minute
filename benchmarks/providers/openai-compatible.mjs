import { normalizeCompletion } from "./provider.mjs";

export function createProvider(cfg = {}) {
  const baseUrl = cfg.baseUrl ?? process.env.WAM_BENCH_BASE_URL;
  const apiKey = cfg.apiKey ?? process.env.WAM_BENCH_API_KEY;
  const model = cfg.model ?? process.env.WAM_BENCH_MODEL;
  const fetchImpl = cfg.fetchImpl ?? globalThis.fetch;
  const providerName = "openai-compatible";

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
        throw new Error(`WAM bench provider request failed: status ${response.status} body=${body}`);
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      const promptText = messages.map((m) => m.content ?? "").join("");
      const raw = {
        text,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? estimateTokens(promptText),
          outputTokens: data.usage?.completion_tokens ?? estimateTokens(text)
        }
      };
      return normalizeCompletion(raw, { model, provider: providerName });
    }
  };
}