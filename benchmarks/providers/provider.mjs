/**
 * @typedef {Object} CompletionUsage
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} totalTokens
 */

/**
 * @typedef {Object} CompletionResult
 * @property {string} text
 * @property {CompletionUsage} usage
 * @property {string} model
 * @property {string} provider
 */

/**
 * @typedef {Object} CompletionRequest
 * @property {Array<{role: string, content: string}>} messages
 * @property {number} [maxTokens]
 * @property {number} [temperature]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} Provider
 * @property {string} model
 * @property {() => boolean} isConfigured
 * @property {(text?: string) => number} estimateTokens
 * @property {(req: CompletionRequest) => Promise<CompletionResult>} complete
 */

export function normalizeCompletion(result, { model, provider }) {
  const text = result?.text ?? "";
  const usageIn = result?.usage ?? {};
  const inputTokens = Number(usageIn.inputTokens) || 0;
  const outputTokens = Number(usageIn.outputTokens) || 0;
  const totalTokens =
    typeof usageIn.totalTokens === "number" && !Number.isNaN(usageIn.totalTokens)
      ? usageIn.totalTokens
      : inputTokens + outputTokens;
  return {
    text,
    usage: { inputTokens, outputTokens, totalTokens },
    model,
    provider
  };
}

export function assertProvider(p) {
  if (
    !p ||
    typeof p.complete !== "function" ||
    typeof p.model !== "string" ||
    typeof p.isConfigured !== "function" ||
    typeof p.estimateTokens !== "function"
  ) {
    throw new Error("Invalid provider: must implement complete, model, isConfigured, estimateTokens");
  }
  return p;
}

export function createMockProvider() {
  const model = "mock/dry-run";
  const estimateTokens = (text = "") => Math.ceil(String(text).length / 4);
  const provider = {
    model,
    isConfigured: () => true,
    estimateTokens,
    complete: async ({ messages }) => {
      const promptText = messages.map((m) => m.content ?? "").join("");
      const text = `[mock-response] ${promptText.length} chars`;
      return normalizeCompletion(
        {
          text,
          usage: {
            inputTokens: estimateTokens(promptText),
            outputTokens: estimateTokens(text)
          }
        },
        { model, provider: "mock" }
      );
    }
  };
  return provider;
}