/**
 * Task State — Create, normalize, and validate task state.
 */

import { PHASE_PROPOSED } from "../integration/orchestration.js";
import { normalizeGoalAssessment } from "./goal-assessment.js";

export function createState(taskId) {
  return {
    taskId,
    phase: PHASE_PROPOSED,
    contract: { status: "DRAFT", requirements: [] },
    requirements: [],
    nextAction: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    goalAssessment: null,
  };
}

export function normalizeState(state) {
  if (!state) return createState("unknown");

  return {
    ...state,
    phase: state.phase || PHASE_PROPOSED,
    contract: state.contract || { status: "DRAFT", requirements: [] },
    requirements: state.requirements || [],
    nextAction: state.nextAction || null,
    createdAt: state.createdAt || Date.now(),
    updatedAt: Date.now(),
    goalAssessment: normalizeGoalAssessment(state.goalAssessment),
  };
}

export function validateState(state) {
  if (!state || !state.taskId) {
    return { valid: false, error: "Missing taskId" };
  }
  if (!state.phase) {
    return { valid: false, error: "Missing phase" };
  }
  return { valid: true };
}
