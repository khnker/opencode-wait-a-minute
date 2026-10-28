import test from "node:test";
import assert from "node:assert/strict";

import {
  buildObservationPrompt,
  createHttpLlmComplete,
  observeWithLlm,
  parseObservationResponse,
} from "./llm-observer.js";
import { observeDialogueTurn } from "./index.js";
import { createIntentDictionary } from "./intent-dictionary.js";

const valid = {
  schema_version: 1,
  language: "es",
  intent: "DEFINE",
  speech_act: "assertion",
  polarity: "affirmative",
  confidence: 0.92,
  answers_pending_question: false,
  references_active_task: true,
  scope_change: false,
  ambiguity: "low",
  contributions: [{ kind: "constraint", text: "usar JWT", confidence: 0.9 }],
  claims: [],
  risk_flags: [],
};

test("prompt includes schema, context and the delimited message", () => {
  const prompt = buildObservationPrompt({
    message: "usa JWT",
    taskState: { phase: "APPROVED", contract: { status: "APPROVED" }, requirements: [{}] },
    dialogueState: { stage: "APPROVED", pendingQuestion: null },
  });
  assert.match(prompt, /stage=APPROVED/);
  assert.match(prompt, /PROVIDE_REQUIREMENT/);
  assert.match(prompt, /<<<[\s\S]*usa JWT[\s\S]*>>>/);
});

test("parseObservationResponse accepts fenced JSON and validates it", () => {
  const obs = parseObservationResponse("```json\n" + JSON.stringify(valid) + "\n```");
  assert.equal(obs.intent, "DEFINE");
  assert.equal(obs.contributions[0].text, "usar JWT");
});

test("parseObservationResponse rejects invalid output", () => {
  assert.throws(() => parseObservationResponse("{not json}"), /invalid dialogue observation/);
});

test("observeWithLlm returns a normalized observation", async () => {
  const obs = await observeWithLlm({
    message: "usa JWT",
    complete: async () => JSON.stringify(valid),
  });
  assert.equal(obs.intent, "DEFINE");
});

test("observeDialogueTurn falls back to heuristic when LLM fails", async () => {
  const turn = await observeDialogueTurn({
    message: "reiniciado ve si esta ok",
    complete: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(turn.source, "heuristic");
  assert.equal(turn.observation.intent, "META");
});

test("observeDialogueTurn uses LLM for ambiguous input and caches it", async () => {
  const dict = createIntentDictionary();
  let calls = 0;
  const complete = async () => {
    calls += 1;
    return JSON.stringify(valid);
  };
  const first = await observeDialogueTurn({ message: "mmm", complete, dictionary: dict });
  assert.equal(first.source, "llm");
  assert.equal(first.observation.intent, "DEFINE");

  const second = await observeDialogueTurn({ message: "mmm", complete, dictionary: dict });
  assert.equal(second.source, "dictionary");
  assert.equal(calls, 1);
});

test("createHttpLlmComplete posts an OpenAI-compatible request", async () => {
  let captured;
  const complete = createHttpLlmComplete({
    endpoint: "http://example.test/v1",
    model: "small",
    apiKey: "secret",
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(valid) } }] }),
      };
    },
  });
  const raw = await complete("classify");
  assert.equal(captured.url, "http://example.test/v1/chat/completions");
  assert.equal(captured.init.headers.authorization, "Bearer secret");
  assert.match(raw, /DEFINE/);
});
