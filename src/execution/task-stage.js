import { getRoleStage } from "../agents/role-contracts.js";

function stageResult(stage, label) {
  return {
    index: stage.index,
    total: stage.total,
    label,
    text: `stage: ${stage.index}/${stage.total} ${label}`,
  };
}

export function describeTaskStage(task = {}) {
  const phase = task.phase || task.state;
  const run = task.agentRun;
  if (phase === "DONE" || (run?.status === "COMPLETED" && run?.verdict === "ACCEPTED")) {
    return { index: 4, total: 4, label: "done", text: "stage: 4/4 done", compact: "stage: done" };
  }

  const results = Array.isArray(run?.results) ? run.results : [];
  const last = results[results.length - 1];
  const lastStage = getRoleStage(last?.role);
  if (lastStage) {
    return {
      ...stageResult(lastStage, lastStage.label),
      compact: `stage: ${lastStage.index}/${lastStage.total} ${lastStage.label}`,
      role: last.role,
    };
  }

  if (run?.status === "BLOCKED" || run?.status === "NEEDS_INPUT") {
    const failedRole = run.failureRole || run.role || last?.role;
    const failedStage = getRoleStage(failedRole);
    return {
      index: failedStage?.index || 0,
      total: failedStage?.total || 4,
      label: "blocked",
      role: failedRole || null,
      text: `stage: ${failedStage?.index || 0}/${failedStage?.total || 4} blocked`,
      compact: "stage: blocked",
    };
  }

  if (phase === "ASKING") {
    return { index: 0, total: 4, label: "clarification", text: "stage: 0/4 clarification", compact: "stage: clarification" };
  }

  if (phase === "PROPOSED") {
    return {
      index: 0,
      total: 4,
      label: "contract",
      text: "stage: 0/4 contract (advisory)",
      compact: "stage: contract",
    };
  }

  return { index: 0, total: 4, label: "ready", text: "stage: ready", compact: "stage: ready" };
}
