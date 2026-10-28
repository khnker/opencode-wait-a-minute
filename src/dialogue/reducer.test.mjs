import test from "node:test";
import assert from "node:assert/strict";

import { DIALOGUE_INTENTS } from "./observation.js";
import { DIALOGUE_STAGES, createDialogueState } from "./dialogue-state.js";
import { DIALOGUE_ACTIONS, reduceDialogue } from "./reducer.js";

function observe(intent, overrides = {}) {
  return { intent, confidence: 0.9, ...overrides };
}

test("dialogue lifecycle: requirement -> definition -> execution -> verification -> done", () => {
  let state = createDialogueState();
  let result = reduceDialogue(state, observe(DIALOGUE_INTENTS.PROVIDE_REQUIREMENT, {
    contributions: [{ kind: "goal", text: "endpoint OAuth2" }],
  }));
  assert.equal(result.state.stage, DIALOGUE_STAGES.INTAKE);
  assert.equal(result.action, DIALOGUE_ACTIONS.DRAFT_REQUIREMENTS);
  state = result.state;

  result = reduceDialogue(state, observe(DIALOGUE_INTENTS.DEFINE, {
    contributions: [{ kind: "constraint", text: "usar JWT" }],
  }));
  assert.equal(result.state.stage, DIALOGUE_STAGES.ELICITATION);
  assert.equal(result.action, DIALOGUE_ACTIONS.UPDATE_REQUIREMENTS);
  state = result.state;

  result = reduceDialogue(state, observe(DIALOGUE_INTENTS.EXECUTE), {
    taskState: { requirements: [{ status: "pending" }], phase: "PROPOSED", contract: { status: "PROPOSED" } },
  });
  assert.equal(result.state.stage, DIALOGUE_STAGES.CONTRACTING);
  assert.equal(result.action, DIALOGUE_ACTIONS.REQUEST_APPROVAL);
  assert.equal(result.state.pendingQuestion, "contract_approval");
  state = result.state;

  result = reduceDialogue(state, observe(DIALOGUE_INTENTS.APPROVE, { answers_pending_question: true }), {
    taskState: { requirements: [{ status: "pending" }], phase: "PROPOSED", contract: { status: "PROPOSED" } },
  });
  assert.equal(result.state.stage, DIALOGUE_STAGES.APPROVED);
  assert.equal(result.action, DIALOGUE_ACTIONS.APPROVE_CONTRACT);
  state = result.state;

  result = reduceDialogue(state, observe(DIALOGUE_INTENTS.EXECUTE), {
    taskState: { requirements: [{ status: "pending" }], phase: "APPROVED", contract: { status: "APPROVED" } },
  });
  assert.equal(result.state.stage, DIALOGUE_STAGES.EXECUTING);
  assert.equal(result.action, DIALOGUE_ACTIONS.EXECUTE);
  state = result.state;

  result = reduceDialogue(state, observe(DIALOGUE_INTENTS.VERIFY), {
    taskState: { requirements: [{ status: "pending" }], phase: "IMPLEMENTING", contract: { status: "APPROVED" } },
  });
  assert.equal(result.state.stage, DIALOGUE_STAGES.VERIFYING);
  assert.equal(result.action, DIALOGUE_ACTIONS.VERIFY);
  state = result.state;

  result = reduceDialogue(state, observe(DIALOGUE_INTENTS.CLAIM_DONE), {
    taskState: {
      requirements: [{ status: "verified", evidence: ["test output"] }],
      phase: "VERIFYING",
      contract: { status: "APPROVED" },
    },
  });
  assert.equal(result.state.stage, DIALOGUE_STAGES.COMPLETED);
  assert.equal(result.action, DIALOGUE_ACTIONS.COMPLETE);
  assert.equal(result.allDone, true);
});

test("META never changes the stage", () => {
  const state = createDialogueState({ stage: DIALOGUE_STAGES.ELICITATION });
  const result = reduceDialogue(state, observe(DIALOGUE_INTENTS.META));
  assert.equal(result.state.stage, DIALOGUE_STAGES.ELICITATION);
  assert.equal(result.action, DIALOGUE_ACTIONS.ANSWER);
});

test("APPROVE without answering the pending question is rejected", () => {
  const state = createDialogueState({ stage: DIALOGUE_STAGES.CONTRACTING });
  const result = reduceDialogue(state, observe(DIALOGUE_INTENTS.APPROVE));
  assert.equal(result.state.stage, DIALOGUE_STAGES.CONTRACTING);
  assert.equal(result.action, DIALOGUE_ACTIONS.INVALID_APPROVAL);
});

test("CLAIM_DONE without verified evidence does not complete", () => {
  const state = createDialogueState({ stage: DIALOGUE_STAGES.VERIFYING });
  const result = reduceDialogue(state, observe(DIALOGUE_INTENTS.CLAIM_DONE), {
    taskState: {
      requirements: [{ status: "pending" }],
      phase: "VERIFYING",
      contract: { status: "APPROVED" },
    },
  });
  assert.equal(result.state.stage, DIALOGUE_STAGES.VERIFYING);
  assert.equal(result.action, DIALOGUE_ACTIONS.BLOCK_COMPLETION);
});

test("scope change re-opens the contract", () => {
  const state = createDialogueState({ stage: DIALOGUE_STAGES.EXECUTING });
  const result = reduceDialogue(state, observe(DIALOGUE_INTENTS.DEFINE, { scope_change: true }), {
    taskState: {
      requirements: [{ status: "pending" }],
      phase: "IMPLEMENTING",
      contract: { status: "APPROVED" },
    },
  });
  assert.equal(result.state.stage, DIALOGUE_STAGES.CONTRACTING);
  assert.equal(result.action, DIALOGUE_ACTIONS.REPROPOSE_CONTRACT);
});

test("high ambiguity asks for clarification instead of moving", () => {
  const state = createDialogueState({ stage: DIALOGUE_STAGES.APPROVED });
  const result = reduceDialogue(state, observe(DIALOGUE_INTENTS.EXECUTE, { ambiguity: "high" }), {
    taskState: {
      requirements: [{ status: "pending" }],
      phase: "APPROVED",
      contract: { status: "APPROVED" },
    },
  });
  assert.equal(result.action, DIALOGUE_ACTIONS.CLARIFY);
  assert.equal(result.requiresConfirmation, true);
});
