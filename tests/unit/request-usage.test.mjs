import test from "node:test";
import assert from "node:assert/strict";

import plugin from "../../index.js";
import { clearRequestUsage, getRequestUsage, requestUsageSize, recordRequestUsage } from "../../src/verification/request-usage.js";

async function hooks() {
  return plugin({ directory: process.cwd(), client: {}, project: {}, $: {} });
}

function assistantEvent({ sessionID = "s1", messageID = "m1", tokens, finish = "stop", role = "assistant" } = {}) {
  return {
    event: {
      type: "message.updated",
      properties: {
        info: { id: messageID, role, sessionID, finish, tokens, cost: 0.01 },
      },
    },
  };
}

test("event hook captures provider-reported tokens", async () => {
  clearRequestUsage();
  const h = await hooks();
  h.event(assistantEvent({
    tokens: { input: 1000, output: 50, reasoning: 10, cache: { read: 200, write: 30 } },
  }));

  const usage = getRequestUsage("s1");
  assert.equal(usage.input, 1000);
  assert.equal(usage.output, 50);
  assert.equal(usage.reasoning, 10);
  assert.equal(usage.cacheRead, 200);
  assert.equal(usage.cacheWrite, 30);
  assert.equal(usage.requestTokens, 1200, "input + cache.read");
  assert.equal(usage.messageID, "m1");
  assert.equal(usage.source, "provider");
});

test("event hook ignores non-assistant and unfinished messages", async () => {
  clearRequestUsage();
  const h = await hooks();

  h.event(assistantEvent({ role: "user", tokens: { input: 1 } }));
  assert.equal(getRequestUsage("s1"), null);

  h.event({
    event: {
      type: "message.updated",
      properties: { info: { id: "m2", role: "assistant", sessionID: "s1", tokens: { input: 10 } } },
    },
  });
  assert.equal(getRequestUsage("s1"), null);
});

test("event hook captures step-finish usage", async () => {
  clearRequestUsage();
  const h = await hooks();

  h.event({
    event: {
      type: "message.part.updated",
      properties: {
        part: {
          type: "step-finish",
          sessionID: "s2",
          messageID: "m3",
          tokens: { input: 400, output: 20, cache: { read: 100 } },
          cost: 0.002,
        },
      },
    },
  });

  const usage = getRequestUsage("s2");
  assert.equal(usage.requestTokens, 500);
  assert.equal(usage.messageID, "m3");
});

test("request usage store is bounded by session", () => {
  clearRequestUsage();
  for (let i = 0; i < 600; i++) {
    recordRequestUsage(`sess-${i}`, { input: 1, requestTokens: 1 });
  }
  assert.equal(requestUsageSize(), 500);
  assert.equal(getRequestUsage("sess-0"), null);
});
