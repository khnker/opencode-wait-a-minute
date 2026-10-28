import {
  DIALOGUE_INTENTS,
  normalizeObservation,
} from "./observation.js";
import {
  DIALOGUE_STAGES,
  dialogueStateFromTask,
  normalizeDialogueState,
  taskPhaseForStage,
} from "./dialogue-state.js";

export const DIALOGUE_ACTIONS = Object.freeze({
  NOOP: "NOOP",
  ANSWER: "ANSWER",
  DRAFT_REQUIREMENTS: "DRAFT_REQUIREMENTS",
  UPDATE_REQUIREMENTS: "UPDATE_REQUIREMENTS",
  REQUEST_GOAL: "REQUEST_GOAL",
  REQUEST_DEFINITION: "REQUEST_DEFINITION",
  PROPOSE_CONTRACT: "PROPOSE_CONTRACT",
  REQUEST_APPROVAL: "REQUEST_APPROVAL",
  APPROVE_CONTRACT: "APPROVE_CONTRACT",
  REVISE_CONTRACT: "REVISE_CONTRACT",
  REPROPOSE_CONTRACT: "REPROPOSE_CONTRACT",
  EXECUTE: "EXECUTE",
  CONTINUE_EXECUTION: "CONTINUE_EXECUTION",
  FIX_AND_EXECUTE: "FIX_AND_EXECUTE",
  VERIFY: "VERIFY",
  COMPLETE: "COMPLETE",
  BLOCK_COMPLETION: "BLOCK_COMPLETION",
  CLARIFY: "CLARIFY",
  REQUEST_CONFIRMATION: "REQUEST_CONFIRMATION",
  INVALID_APPROVAL: "INVALID_APPROVAL",
  REQUEST_EXECUTION_FIRST: "REQUEST_EXECUTION_FIRST",
  CANCEL: "CANCEL",
  RESUME: "RESUME",
  ACKNOWLEDGE: "ACKNOWLEDGE",
});

const CONTRIBUTION_INTENTS = new Set([
  DIALOGUE_INTENTS.PROVIDE_REQUIREMENT,
  DIALOGUE_INTENTS.DEFINE,
  DIALOGUE_INTENTS.ADD_CONSTRAINT,
  DIALOGUE_INTENTS.ADD_ACCEPTANCE_CRITERION,
  DIALOGUE_INTENTS.CORRECT,
]);

const CONTRACT_STAGES = new Set([
  DIALOGUE_STAGES.INTAKE,
  DIALOGUE_STAGES.ELICITATION,
  DIALOGUE_STAGES.CONTRACTING,
]);

const POST_APPROVAL_STAGES = new Set([
  DIALOGUE_STAGES.APPROVED,
  DIALOGUE_STAGES.EXECUTING,
  DIALOGUE_STAGES.VERIFYING,
]);

const DESTRUCTIVE_INTENTS = new Set([
  DIALOGUE_INTENTS.EXECUTE,
  DIALOGUE_INTENTS.APPROVE,
  DIALOGUE_INTENTS.CANCEL,
]);

function requirementsVerified(taskState) {
  const requirements = Array.isArray(taskState?.requirements) ? taskState.requirements : [];
  if (!requirements.length) return false;
  return requirements.every((r) => {
    if (r?.status !== "verified") return false;
    return Array.isArray(r.evidence) && r.evidence.length > 0;
  });
}

function appendContributions(state, observation) {
  if (!CONTRIBUTION_INTENTS.has(observation.intent)) return state.contributions;
  const next = [...state.contributions];
  const seen = new Set(next.map((c) => `${c.kind}:${String(c.text).toLowerCase()}`));
  for (const contribution of observation.contributions) {
    const key = `${contribution.kind}:${contribution.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(contribution);
  }
  return next.slice(-20);
}

function inferPendingQuestion(state, taskState) {
  if (state.pendingQuestion) return state.pendingQuestion;
  if (
    taskState?.contract?.status === "PROPOSED" &&
    taskState?.phase === "PROPOSED" &&
    Array.isArray(taskState?.requirements) &&
    taskState.requirements.length > 0
  ) {
    return "contract_approval";
  }
  return null;
}

export function reduceDialogue(previousState, observationInput, { taskState } = {}) {
  const base = dialogueStateFromTask(taskState);
  const previous = normalizeDialogueState(previousState || base);
  const observation = normalizeObservation(observationInput);
  let stage = previous.stage;
  let action = DIALOGUE_ACTIONS.NOOP;
  let pendingQuestion = inferPendingQuestion(previous, taskState);
  let requiresConfirmation = false;

  if (observation.answers_pending_question && pendingQuestion) {
    pendingQuestion = null;
  }

  switch (observation.intent) {
    case DIALOGUE_INTENTS.META:
    case DIALOGUE_INTENTS.CLARIFY:
    case DIALOGUE_INTENTS.ANSWER:
      action = DIALOGUE_ACTIONS.ANSWER;
      break;

    case DIALOGUE_INTENTS.PROVIDE_REQUIREMENT:
      if (stage === DIALOGUE_STAGES.IDLE || stage === DIALOGUE_STAGES.COMPLETED) {
        stage = DIALOGUE_STAGES.INTAKE;
        action = DIALOGUE_ACTIONS.DRAFT_REQUIREMENTS;
      } else if (POST_APPROVAL_STAGES.has(stage)) {
        stage = DIALOGUE_STAGES.CONTRACTING;
        action = DIALOGUE_ACTIONS.REPROPOSE_CONTRACT;
      } else {
        action = DIALOGUE_ACTIONS.UPDATE_REQUIREMENTS;
      }
      break;

    case DIALOGUE_INTENTS.DEFINE:
    case DIALOGUE_INTENTS.ADD_CONSTRAINT:
    case DIALOGUE_INTENTS.ADD_ACCEPTANCE_CRITERION:
      if (stage === DIALOGUE_STAGES.IDLE) {
        stage = DIALOGUE_STAGES.INTAKE;
        action = DIALOGUE_ACTIONS.REQUEST_GOAL;
      } else if (stage === DIALOGUE_STAGES.INTAKE) {
        stage = DIALOGUE_STAGES.ELICITATION;
        action = DIALOGUE_ACTIONS.UPDATE_REQUIREMENTS;
      } else if (POST_APPROVAL_STAGES.has(stage)) {
        stage = DIALOGUE_STAGES.CONTRACTING;
        action = DIALOGUE_ACTIONS.REPROPOSE_CONTRACT;
      } else {
        action = DIALOGUE_ACTIONS.UPDATE_REQUIREMENTS;
      }
      break;

    case DIALOGUE_INTENTS.CORRECT:
      if (stage === DIALOGUE_STAGES.IDLE) stage = DIALOGUE_STAGES.INTAKE;
      action = DIALOGUE_ACTIONS.UPDATE_REQUIREMENTS;
      break;

    case DIALOGUE_INTENTS.EXECUTE:
      if (stage === DIALOGUE_STAGES.IDLE) {
        stage = DIALOGUE_STAGES.INTAKE;
        action = DIALOGUE_ACTIONS.REQUEST_GOAL;
      } else if (CONTRACT_STAGES.has(stage)) {
        stage = DIALOGUE_STAGES.CONTRACTING;
        action = DIALOGUE_ACTIONS.REQUEST_APPROVAL;
        pendingQuestion = "contract_approval";
      } else if (stage === DIALOGUE_STAGES.APPROVED) {
        stage = DIALOGUE_STAGES.EXECUTING;
        action = DIALOGUE_ACTIONS.EXECUTE;
      } else if (stage === DIALOGUE_STAGES.EXECUTING) {
        action = DIALOGUE_ACTIONS.CONTINUE_EXECUTION;
      } else if (stage === DIALOGUE_STAGES.VERIFYING) {
        stage = DIALOGUE_STAGES.EXECUTING;
        action = DIALOGUE_ACTIONS.FIX_AND_EXECUTE;
      } else {
        action = DIALOGUE_ACTIONS.REQUEST_GOAL;
      }
      break;

    case DIALOGUE_INTENTS.APPROVE:
      if (stage === DIALOGUE_STAGES.CONTRACTING && observation.answers_pending_question) {
        stage = DIALOGUE_STAGES.APPROVED;
        action = DIALOGUE_ACTIONS.APPROVE_CONTRACT;
      } else if (stage === DIALOGUE_STAGES.APPROVED) {
        action = DIALOGUE_ACTIONS.NOOP;
      } else {
        action = DIALOGUE_ACTIONS.INVALID_APPROVAL;
      }
      break;

    case DIALOGUE_INTENTS.REJECT:
      if (stage === DIALOGUE_STAGES.CONTRACTING || stage === DIALOGUE_STAGES.APPROVED) {
        stage = DIALOGUE_STAGES.ELICITATION;
        action = DIALOGUE_ACTIONS.REVISE_CONTRACT;
      } else {
        action = DIALOGUE_ACTIONS.ACKNOWLEDGE;
      }
      break;

    case DIALOGUE_INTENTS.VERIFY:
      if (
        stage === DIALOGUE_STAGES.APPROVED ||
        stage === DIALOGUE_STAGES.EXECUTING ||
        stage === DIALOGUE_STAGES.VERIFYING
      ) {
        stage = DIALOGUE_STAGES.VERIFYING;
        action = DIALOGUE_ACTIONS.VERIFY;
      } else {
        action = DIALOGUE_ACTIONS.REQUEST_EXECUTION_FIRST;
      }
      break;

    case DIALOGUE_INTENTS.CLAIM_DONE:
      if (requirementsVerified(taskState)) {
        stage = DIALOGUE_STAGES.COMPLETED;
        action = DIALOGUE_ACTIONS.COMPLETE;
      } else {
        action = DIALOGUE_ACTIONS.BLOCK_COMPLETION;
      }
      break;

    case DIALOGUE_INTENTS.CANCEL:
      stage = DIALOGUE_STAGES.CANCELLED;
      action = DIALOGUE_ACTIONS.CANCEL;
      break;

    case DIALOGUE_INTENTS.RESUME:
      if (stage === DIALOGUE_STAGES.IDLE) stage = base.stage;
      action = DIALOGUE_ACTIONS.RESUME;
      break;

    default:
      action = DIALOGUE_ACTIONS.NOOP;
      break;
  }

  if (
    observation.scope_change &&
    stage !== DIALOGUE_STAGES.IDLE &&
    stage !== DIALOGUE_STAGES.COMPLETED &&
    stage !== DIALOGUE_STAGES.CANCELLED
  ) {
    stage = DIALOGUE_STAGES.CONTRACTING;
    action = DIALOGUE_ACTIONS.REPROPOSE_CONTRACT;
  }

  if (observation.ambiguity === "high" && observation.intent !== DIALOGUE_INTENTS.META) {
    action = DIALOGUE_ACTIONS.CLARIFY;
    requiresConfirmation = true;
  }

  if (
    observation.risk_flags.length > 0 &&
    DESTRUCTIVE_INTENTS.has(observation.intent) &&
    action !== DIALOGUE_ACTIONS.NOOP
  ) {
    requiresConfirmation = true;
  }

  return {
    state: {
      ...previous,
      stage,
      pendingQuestion,
      contributions: appendContributions(previous, observation),
      lastIntent: observation.intent,
      updatedAt: Date.now(),
    },
    action,
    requiresConfirmation,
    observation,
    taskPhase: taskPhaseForStage(stage),
    allDone: stage === DIALOGUE_STAGES.COMPLETED,
  };
}
