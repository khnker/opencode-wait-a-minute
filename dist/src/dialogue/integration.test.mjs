import test from "node:test";
import assert from "node:assert/strict";

import { synthesizeContract } from "../skills/engine.js";
import { classifyIntentLane, INTENT_LANES } from "../policy/intent-router.js";
import { DIALOGUE_INTENTS } from "./observation.js";
import { DIALOGUE_STAGES } from "./dialogue-state.js";
import { heuristicObserve } from "./heuristic-observer.js";
import { reduceDialogue } from "./reducer.js";

test("status message creates no contract requirements and no stage", () => {
  const message = "reiniciado ve si esta ok";
  const contract = synthesizeContract(message);
  const lane = classifyIntentLane(message);
  const observation = heuristicObserve({ message });
  const reduced = reduceDialogue(undefined, observation);

  assert.equal(contract.trivial, true);
  assert.deepEqual(contract.requirements, []);
  assert.equal(lane.lane, INTENT_LANES.CONVERSATION);
  assert.equal(observation.intent, DIALOGUE_INTENTS.META);
  assert.equal(reduced.state.stage, DIALOGUE_STAGES.IDLE);
});

test("status questions never synthesize requirements", () => {
  for (const message of ["falta algo ?", "¿qué falta?", "algo más?", "¿está listo?"]) {
    const contract = synthesizeContract(message);
    const lane = classifyIntentLane(message);
    const observation = heuristicObserve({ message });
    const reduced = reduceDialogue(undefined, observation);

    assert.equal(contract.trivial, true, message);
    assert.deepEqual(contract.requirements, [], message);
    assert.equal(lane.lane, INTENT_LANES.CONVERSATION, message);
    assert.equal(observation.intent, DIALOGUE_INTENTS.META, message);
    assert.equal(reduced.state.stage, DIALOGUE_STAGES.IDLE, message);
  }
});

test("actionable 'falta implementar' stays a task", () => {
  const message = "falta implementar el endpoint";
  assert.equal(classifyIntentLane(message).lane, INTENT_LANES.TASK_NEW);
  assert.equal(heuristicObserve({ message }).intent, DIALOGUE_INTENTS.PROVIDE_REQUIREMENT);
});
