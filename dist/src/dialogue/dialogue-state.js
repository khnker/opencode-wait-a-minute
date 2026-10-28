import { DIALOGUE_INTENTS, normalizeObservation } from "./observation.js";

export const DIALOGUE_STAGES = Object.freeze({
  IDLE: "IDLE",
  INTAKE: "INTAKE",
  ELICITATION: "ELICITATION",
  CONTRACTING: "CONTRACTING",
  APPROVED: "APPROVED",
  EXECUTING: "EXECUTING",
  VERIFYING: "VERIFYING",
  COMPLETED: "COMPLETED",
  BLOCKED: "BLOCKED",
  CANCELLED: "CANCELLED",
});

export const STAGE_VALUES = new Set(Object.values(DIALOGUE_STAGES));

const STAGE_TO_TASK_PHASE = Object.freeze({
  [DIALOGUE_STAGES.INTAKE]: "PROPOSED",
  [DIALOGUE_STAGES.ELICITATION]: "PROPOSED",
  [DIALOGUE_STAGES.CONTRACTING]: "PROPOSED",
  [DIALOGUE_STAGES.APPROVED]: "APPROVED",
  [DIALOGUE_STAGES.EXECUTING]: "IMPLEMENTING",
  [DIALOGUE_STAGES.VERIFYING]: "VERIFYING",
  [DIALOGUE_STAGES.COMPLETED]: "DONE",
  [DIALOGUE_STAGES.BLOCKED]: "ASKING",
});

export function createDialogueState(overrides = {}) {
  return {
    version: 1,
    stage: DIALOGUE_STAGES.IDLE,
    pendingQuestion: null,
    contributions: [],
    lastIntent: DIALOGUE_INTENTS.UNKNOWN,
    updatedAt: 0,
    ...overrides,
  };
}

export function normalizeDialogueState(state) {
  const source = state && typeof state === "object" ? state : {};
  return {
    version: 1,
    stage: STAGE_VALUES.has(source.stage) ? source.stage : DIALOGUE_STAGES.IDLE,
    pendingQuestion:
      typeof source.pendingQuestion === "string" && source.pendingQuestion
        ? source.pendingQuestion
        : null,
    contributions: Array.isArray(source.contributions)
      ? source.contributions.slice(-20)
      : [],
    lastIntent:
      typeof source.lastIntent === "string" ? source.lastIntent : DIALOGUE_INTENTS.UNKNOWN,
    updatedAt: Number(source.updatedAt) || 0,
  };
}

export function inferStageFromTask(taskState) {
  if (taskState?.dialogue?.stage && STAGE_VALUES.has(taskState.dialogue.stage)) {
    return taskState.dialogue.stage;
  }
  if (!taskState) return DIALOGUE_STAGES.IDLE;
  if (taskState.phase === "DONE") return DIALOGUE_STAGES.COMPLETED;
  if (taskState.phase === "VERIFYING") return DIALOGUE_STAGES.VERIFYING;
  if (taskState.phase === "IMPLEMENTING") return DIALOGUE_STAGES.EXECUTING;
  if (taskState.phase === "APPROVED") return DIALOGUE_STAGES.APPROVED;
  if (taskState.phase === "ASKING" || taskState.phase === "WAITING") {
    return DIALOGUE_STAGES.BLOCKED;
  }
  const requirements = Array.isArray(taskState.requirements) ? taskState.requirements : [];
  if (requirements.length > 0) return DIALOGUE_STAGES.CONTRACTING;
  return DIALOGUE_STAGES.IDLE;
}

export function taskPhaseForStage(stage) {
  return STAGE_TO_TASK_PHASE[stage] || null;
}

export function stateSignature(taskState, dialogueState) {
  const stage = dialogueState?.stage || inferStageFromTask(taskState);
  const pending = dialogueState?.pendingQuestion || "none";
  const active = Array.isArray(taskState?.requirements) && taskState.requirements.length > 0;
  const approved = taskState?.contract?.status === "APPROVED";
  return `${stage}|${pending}|${active ? "active" : "idle"}|${approved ? "approved" : "unapproved"}`;
}

export function dialogueStateFromTask(taskState) {
  if (taskState?.dialogue) return normalizeDialogueState(taskState.dialogue);
  const pendingQuestion =
    taskState?.contract?.status === "PROPOSED" &&
    taskState?.phase === "PROPOSED" &&
    Array.isArray(taskState?.requirements) &&
    taskState.requirements.length > 0
      ? "contract_approval"
      : null;
  return createDialogueState({
    stage: inferStageFromTask(taskState),
    pendingQuestion,
  });
}

export function observationFromTask(taskState) {
  return normalizeObservation({
    intent: DIALOGUE_INTENTS.UNKNOWN,
    references_active_task: Boolean(taskState),
  });
}
