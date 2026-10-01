import { createProvider } from "./openai-compatible.mjs";
import { assertProvider, createMockProvider, normalizeCompletion } from "./provider.mjs";

export function resolveProvider({ env = process.env, fetchImpl } = {}) {
  const dryRun =
    env.WAM_BENCH_MODE === "dry-run" ||
    (!env.WAM_BENCH_BASE_URL && env.WAM_BENCH_REAL_MODEL !== "1");

  if (dryRun) {
    return assertProvider(createMockProvider());
  }

  const provider = createProvider({
    baseUrl: env.WAM_BENCH_BASE_URL,
    apiKey: env.WAM_BENCH_API_KEY,
    model: env.WAM_BENCH_MODEL,
    fetchImpl
  });
  return assertProvider(provider);
}

export { createProvider, createMockProvider, normalizeCompletion, assertProvider };