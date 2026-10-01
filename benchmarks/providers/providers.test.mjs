import { describe, it } from "node:test";
import assert, { strict } from "node:assert/strict";
import {
  normalizeCompletion,
  assertProvider,
  createMockProvider
} from "./provider.mjs";
import { createProvider } from "./openai-compatible.mjs";
import { resolveProvider } from "./index.mjs";

describe("normalizeCompletion", () => {
  it("adds totalTokens when not present", () => {
    const result = normalizeCompletion(
      { text: "x", usage: { inputTokens: 3, outputTokens: 2 } },
      { model: "m", provider: "p" }
    );
    assert.deepStrictEqual(result.usage, {
      inputTokens: 3,
      outputTokens: 2,
      totalTokens: 5
    });
    assert.strictEqual(result.model, "m");
    assert.strictEqual(result.provider, "p");
  });

  it("preserves provided totalTokens", () => {
    const result = normalizeCompletion(
      { text: "test", usage: { inputTokens: 1, outputTokens: 2, totalTokens: 10 } },
      { model: "m", provider: "p" }
    );
    assert.strictEqual(result.usage.totalTokens, 10);
  });

  it("coerces missing numbers to 0", () => {
    const result = normalizeCompletion({}, { model: "m", provider: "p" });
    assert.deepStrictEqual(result.usage, {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    });
  });
});

describe("assertProvider", () => {
  it("throws for empty object", () => {
    assert.throws(() => assertProvider({}), /Invalid provider/);
  });

  it("throws for missing methods", () => {
    assert.throws(() => assertProvider({ model: "m" }), /Invalid provider/);
    assert.throws(() => assertProvider({ complete: async () => {}, model: "m", isConfigured: () => true }), /Invalid provider/);
  });

  it("returns provider for valid object", () => {
    const p = { model: "m", isConfigured: () => true, estimateTokens: () => 1, complete: async () => ({}) };
    assert.strictEqual(assertProvider(p), p);
  });
});

describe("createProvider with injected fetchImpl", () => {
  it("returns normalized output with totalTokens and provider", async () => {
    let fetchCalledWith = null;
    const fakeFetch = async (url, opts) => {
      fetchCalledWith = { url, opts };
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "test response" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        })
      };
    };

    const provider = createProvider({
      baseUrl: "http://test.example.com",
      apiKey: "test-key",
      model: "test-model",
      fetchImpl: fakeFetch
    });

    strict.equal(provider.model, "test-model");

    const result = await provider.complete({ messages: [{ role: "user", content: "hello" }] });
    strict.equal(result.model, "test-model");
    strict.equal(result.provider, "openai-compatible");
    strict.equal(result.usage.totalTokens, 15);
    strict.equal(result.usage.inputTokens, 10);
    strict.equal(result.usage.outputTokens, 5);
    strict.equal(fetchCalledWith.url, "http://test.example.com/chat/completions");
  });
});

describe("resolveProvider", () => {
  it("returns mock provider for empty env", () => {
    const provider = resolveProvider({ env: {} });
    strict.equal(provider.model, "mock/dry-run");
    strict.equal(provider.isConfigured(), true);
  });

  it("returns real provider for configured env without network call", () => {
    let fetchCalled = false;
    const fakeFetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({ choices: [], usage: {} }) };
    };

    const provider = resolveProvider({
      env: {
        WAM_BENCH_BASE_URL: "http://x",
        WAM_BENCH_API_KEY: "k",
        WAM_BENCH_MODEL: "m"
      },
      fetchImpl: fakeFetch
    });

    strict.equal(provider.isConfigured(), true);
    strict.equal(fetchCalled, false);
    strict.equal(provider.model, "m");
  });
});