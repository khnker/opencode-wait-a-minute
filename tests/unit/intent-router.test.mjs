import test from "node:test";
import assert from "node:assert/strict";

import { classifyIntentLane, INTENT_LANES } from "../../src/policy/intent-router.js";

test("meta messages are conversation", () => {
  assert.equal(classifyIntentLane("ok").lane, INTENT_LANES.CONVERSATION);
  assert.equal(classifyIntentLane("no te detengas").lane, INTENT_LANES.CONVERSATION);
});

test("continuation requires an active task", () => {
  assert.equal(
    classifyIntentLane("sigue con el paso 2", { hasActiveTask: true }).lane,
    INTENT_LANES.CONTINUATION
  );
});

test("corrections are detected", () => {
  assert.equal(
    classifyIntentLane("no, era con soft delete", { hasActiveTask: true }).lane,
    INTENT_LANES.CORRECTION
  );
});

test("actionable prompts are new tasks", () => {
  assert.equal(
    classifyIntentLane("implementa un endpoint OAuth2 con tests").lane,
    INTENT_LANES.TASK_NEW
  );
});
