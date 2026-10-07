/**
 * Regression tests for the chat.message re-entrancy / self-consumption bug.
 *
 * Invariant: chat.message is idempotent per message id and reads the prompt
 * ONLY from the user's input, never from the synthetic parts WAM injects.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  handleMessage,
  extractPrompt,
  isMessageAlreadyProcessed,
  _resetProcessedMessages,
} from "../src/integration/message-handler.js";
import { tagWamPart } from "../src/integration/part-provenance.js";

test("extractPrompt ignores synthetic WAM parts", () => {
  const input = {
    message: {
      parts: [
        tagWamPart({ type: "text", text: "synthetic injection" }, { messageID: "m1" }),
        { type: "text", text: "real user text" },
      ],
    },
  };
  assert.equal(extractPrompt(input, {}), "real user text");
});

test("extractPrompt never reads output.parts", () => {
  const input = { message: { parts: [] } };
  const output = { parts: [{ type: "text", text: "from output" }] };
  assert.equal(extractPrompt(input, output), "");
});

test("extractPrompt falls back to input.text", () => {
  assert.equal(extractPrompt({ text: "hello" }, {}), "hello");
});

test("isMessageAlreadyProcessed detects WAM markers", () => {
  _resetProcessedMessages();
  const output = {
    message: { id: "m1" },
    parts: [tagWamPart({ type: "text", text: "x" }, { messageID: "m1" })],
  };
  assert.equal(isMessageAlreadyProcessed({ messageID: "m1" }, output), true);
  assert.equal(isMessageAlreadyProcessed({ messageID: "m2" }, output), false);
});

test("handleMessage is idempotent per message id", async () => {
  _resetProcessedMessages();
  const input = {
    messageID: "m-dup",
    sessionID: "s1",
    message: { parts: [{ type: "text", text: "do the thing" }] },
  };
  const output = { message: { id: "m-dup" }, parts: [] };
  const calls = [];
  const deps = {
    bypassed: false,
    sessionTasks: new Map(),
    sessionStore: new Map(),
    cfg: {},
    emitTextPart: () => calls.push("emit"),
    ensureWamMemory: async () => "/tmp/wam-idempotency",
    effectiveTaskId: () => "t",
    migrateLegacyCognition: () => {},
    noteSuccess: async () => {},
    noteFailure: async () => {},
    getTaskState: () => null,
    classifyAskingMessage: () => "answer",
  };
  try { await handleMessage(input, output, deps); } catch {}
  assert.equal(isMessageAlreadyProcessed(input, output), true);
  const afterFirst = calls.length;
  try { await handleMessage(input, output, deps); } catch {}
  assert.equal(calls.length, afterFirst, "second invocation must be a no-op");
});
