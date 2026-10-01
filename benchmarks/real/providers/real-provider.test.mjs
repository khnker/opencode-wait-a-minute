import { test } from "node:test";
import assert from "node:assert/strict";
import { createRealProvider } from "./provider.mjs";

function makeFetch(payload) {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    }
  });
}

test("createRealProvider wraps an openai-compatible provider with extended contract", async () => {
  const payload = {
    choices: [{ message: { content: "hello world" } }],
    usage: {
      prompt_tokens: 42,
      completion_tokens: 7,
      total_tokens: 49,
      prompt_tokens_details: { cached_tokens: 13 }
    }
  };
  const fetchImpl = makeFetch(payload);
  let t0 = 0;
  const provider = createRealProvider({
    kind: "openai-compatible",
    baseUrl: "https://api.example.test",
    apiKey: "sk-test",
    model: "test-model",
    fetchImpl,
    now: () => {
      t0 += 1;
      return t0 * 5; // 5ms per call
    }
  });

  assert.equal(provider.model, "test-model");
  assert.equal(provider.isConfigured(), true);
  const result = await provider.complete({
    messages: [{ role: "user", content: "hi" }],
    maxTokens: 64
  });

  assert.equal(result.text, "hello world");
  assert.equal(result.usage.inputTokens, 42);
  assert.equal(result.usage.outputTokens, 7);
  assert.equal(result.usage.totalTokens, 49);
  assert.equal(result.usage.cachedInputTokens, 13);
  assert.equal(typeof result.latencyMs, "number");
  assert.ok(Number.isFinite(result.latencyMs));
  assert.ok(result.latencyMs >= 0);
  assert.equal(result.model, "test-model");
  assert.equal(result.provider, "openai-compatible");
});

test("cachedInputTokens defaults to 0 when provider does not report cache", async () => {
  const payload = {
    choices: [{ message: { content: "ok" } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
  };
  const provider = createRealProvider({
    kind: "openai-compatible",
    baseUrl: "https://api.example.test",
    apiKey: "sk-test",
    model: "m",
    fetchImpl: makeFetch(payload),
    now: () => 0
  });
  const result = await provider.complete({ messages: [{ role: "user", content: "x" }] });
  assert.equal(result.usage.cachedInputTokens, 0);
  assert.equal(result.usage.inputTokens, 10);
  assert.equal(result.usage.outputTokens, 5);
  assert.equal(result.usage.totalTokens, 15);
});

test("createRealProvider supports mock kind with no network", async () => {
  const provider = createRealProvider({ kind: "mock", model: "mock/m", now: () => 0 });
  const result = await provider.complete({ messages: [{ role: "user", content: "abc" }] });
  assert.equal(typeof result.text, "string");
  assert.equal(result.usage.cachedInputTokens, 0);
  assert.equal(typeof result.latencyMs, "number");
  assert.ok(Number.isFinite(result.latencyMs));
});

test("responses/usage passthrough surfaces optional provider objects", async () => {
  const provider = createRealProvider({
    kind: "mock",
    model: "mock/m",
    now: () => 0
  });
  const result = await provider.complete({
    messages: [{ role: "user", content: "x" }],
    responses: { id: "r-1" },
    usage: { raw: true }
  });
  assert.deepEqual(result.responses, { id: "r-1" });
  assert.deepEqual(result.rawUsage, { raw: true });
});

test("createRealProvider surfaces provider errors via injected fetchImpl", async () => {
  const provider = createRealProvider({
    kind: "openai-compatible",
    baseUrl: "https://api.example.test",
    apiKey: "sk-test",
    model: "m",
    fetchImpl: async () => ({ ok: false, status: 500, async text() { return "boom"; } }),
    now: () => 0
  });
  await assert.rejects(provider.complete({ messages: [{ role: "user", content: "x" }] }));
});
