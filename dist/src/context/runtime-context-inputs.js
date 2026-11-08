/**
 * Runtime context inputs — loads persisted task layers for graph reconstruction.
 *
 * Every source load is independent and fail-soft: a missing or corrupt file
 * yields an empty layer instead of breaking context assembly.
 */

import { getRuns } from "../state/task-runs.js";
import { getAllEvidence } from "../evidence/evidence-lineage.js";
import { buildCompactState } from "../cognition/cognition-store.js";

const DEFAULTS = {
  evidence: 30,
  decisions: 20,
  observations: 20,
  hypotheses: 10,
  experiments: 10,
  constraints: 10,
  content: 500,
};

export function normalizeTaskState(taskState, taskId) {
  return { ...(taskState || {}), taskId: taskState?.taskId || taskId };
}

export function truncateContent(value, max = DEFAULTS.content) {
  if (value == null) return "";
  const text = typeof value === "string" ? value : String(value);
  return text.length > max ? text.slice(0, max) : text;
}

function timestamp(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function requirementIds(taskState) {
  const ids = new Set();
  for (const req of taskState?.requirements || []) {
    if (req?.id) ids.add(req.id);
  }
  return ids;
}

function pickRun(runs, taskState) {
  if (!Array.isArray(runs) || runs.length === 0) return null;
  const currentRunId = taskState?.currentRunId;
  if (currentRunId) {
    const current = runs.find(
      (run) => run?.id === currentRunId || run?.runId === currentRunId,
    );
    if (current) return current;
  }
  const active = runs.find((run) => run?.status === "active");
  if (active) return active;
  return runs[runs.length - 1] || null;
}

function normalizeEvidence(entry, maxContent) {
  if (!entry?.id) return null;
  return {
    ...entry,
    id: entry.id,
    content: truncateContent(entry.content, maxContent),
  };
}

function evidenceOrder(a, b) {
  const verified = (item) =>
    item?.status === "valid" || item?.verified === true ? 1 : 0;
  return (
    verified(b) - verified(a) ||
    timestamp(b.createdAt) - timestamp(a.createdAt) ||
    String(a.id).localeCompare(String(b.id))
  );
}

function decisionsFromAgentRun(taskState, caps) {
  const results = taskState?.agentRun?.results;
  if (Array.isArray(results) && results.length > 0) {
    return results
      .map((result, index) => {
        const summary = result?.summary || result?.message || result?.role || "";
        if (!summary) return null;
        return {
          id: `agent-result-${index + 1}`,
          summary,
          requirementId: result?.requirementId || null,
          status: result?.status || "accepted",
          madeAt: result?.completedAt || result?.updatedAt || null,
        };
      })
      .filter(Boolean)
      .slice(-caps.decisions);
  }

  const history = taskState?.agentHistory;
  if (Array.isArray(history) && history.length > 0) {
    return history
      .map((entry, index) => {
        const summary = entry?.verdict || entry?.status || "";
        if (!summary) return null;
        return {
          id: `agent-history-${index + 1}`,
          summary: `Agent run ${summary}`,
          requirementId: null,
          status: entry?.status || "accepted",
          madeAt: entry?.updatedAt || null,
        };
      })
      .filter(Boolean)
      .slice(-caps.decisions);
  }

  return [];
}

function normalizeDecision(decision, run, index) {
  const runId = run?.id || run?.runId || "run";
  if (decision == null) return null;
  return {
    id: decision?.id || `dec-${runId}-${index + 1}`,
    summary:
      decision?.summary ||
      decision?.description ||
      decision?.text ||
      decision?.decision ||
      String(decision),
    requirementId: decision?.requirementId || null,
    status: decision?.status || "accepted",
    madeAt: decision?.madeAt || decision?.timestamp || run?.completedAt || null,
  };
}

function observationContent(observation) {
  if (observation == null) return "";
  if (Array.isArray(observation.facts)) return observation.facts.join("; ");
  return (
    observation.content ||
    observation.summary ||
    observation.text ||
    observation.actual ||
    observation.result ||
    ""
  );
}

function normalizeObservation(observation, index, maxContent) {
  if (observation == null) return null;
  return {
    ...(typeof observation === "object" ? observation : {}),
    id:
      observation?.id ||
      observation?.experimentId ||
      `obs-${index + 1}`,
    content: truncateContent(observationContent(observation), maxContent),
  };
}

function normalizeHypothesis(hypothesis, index) {
  if (hypothesis == null) return null;
  return {
    ...(typeof hypothesis === "object" ? hypothesis : {}),
    id: hypothesis?.id || `hyp-${index + 1}`,
    statement:
      hypothesis?.statement ||
      hypothesis?.content ||
      hypothesis?.reason ||
      "",
    status: hypothesis?.status || "proposed",
    requirementId: hypothesis?.requirementId || null,
  };
}

function normalizeExperiment(experiment, index) {
  if (experiment == null) return null;
  return {
    id: experiment?.id || `exp-${index + 1}`,
    description:
      experiment?.actionDescription ||
      experiment?.description ||
      experiment?.content ||
      experiment?.result ||
      "",
    status: experiment?.status || "proposed",
    hypothesisId: experiment?.hypothesisId || null,
    requirementId: experiment?.requirementId || null,
    provenance: experiment?.provenance || "run_execution",
  };
}

function normalizeConstraints(taskState, max) {
  const raw = taskState?.contract?.constraints;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item != null && item !== "")
    .slice(0, max)
    .map((item, index) => ({
      id: `constraint-${index + 1}`,
      description:
        typeof item === "string"
          ? item
          : item?.description || item?.text || String(item),
      provenance: "user_decided",
    }));
}

export function loadRuntimeContextInputs({ taskId, root, taskState, limits } = {}) {
  const caps = { ...DEFAULTS, ...(limits || {}) };
  const normalizedTaskState = normalizeTaskState(taskState, taskId);
  const result = {
    taskState: normalizedTaskState,
    runState: null,
    evidenceLineage: [],
    cognitionState: null,
    decisions: [],
    constraints: normalizeConstraints(normalizedTaskState, caps.constraints),
    artifacts: [],
    observations: [],
    hypotheses: [],
    experiments: [],
  };

  if (!taskId || !root) return result;

  let runs = [];
  try {
    runs = getRuns(taskId, root) || [];
  } catch {
    runs = [];
  }
  const run = pickRun(runs, normalizedTaskState);
  result.runState = run;

  try {
    const knownRequirements = requirementIds(normalizedTaskState);
    const filtered = (getAllEvidence(taskId, root) || []).filter((entry) => {
      if (!entry?.requirementId) return true;
      return knownRequirements.has(entry.requirementId);
    });
    result.evidenceLineage = filtered
      .map((entry) => normalizeEvidence(entry, caps.content))
      .filter(Boolean)
      .sort(evidenceOrder)
      .slice(0, caps.evidence);
  } catch {
    result.evidenceLineage = [];
  }

  if (run) {
    try {
      result.decisions = (run.decisions || [])
        .map((decision, index) => normalizeDecision(decision, run, index))
        .filter(Boolean)
        .slice(-caps.decisions);
    } catch {
      result.decisions = [];
    }
  }

  if (result.decisions.length === 0) {
    result.decisions = decisionsFromAgentRun(normalizedTaskState, caps);
  }

  let compact = null;
  try {
    compact = buildCompactState(root, taskId);
  } catch {
    compact = null;
  }

  try {
    const seen = new Set();
    const merged = [...(run?.observations || []), ...(compact?.recentObservations || [])];
    const observations = [];
    for (let index = 0; index < merged.length; index += 1) {
      const observation = normalizeObservation(merged[index], index, caps.content);
      if (!observation) continue;
      if (seen.has(observation.id)) continue;
      seen.add(observation.id);
      observations.push(observation);
    }
    result.observations = observations.slice(-caps.observations);
  } catch {
    result.observations = [];
  }

  try {
    const hypotheses = [
      ...(compact?.activeHypotheses || []),
      ...(compact?.supportedHypotheses || []),
      ...(compact?.rejectedHypotheses || []),
    ];
    result.hypotheses = hypotheses
      .map((hypothesis, index) => normalizeHypothesis(hypothesis, index))
      .filter(Boolean)
      .slice(0, caps.hypotheses);
  } catch {
    result.hypotheses = [];
  }

  try {
    result.experiments = (compact?.recentExperiments || [])
      .map((experiment, index) => normalizeExperiment(experiment, index))
      .filter(Boolean)
      .slice(0, caps.experiments);
  } catch {
    result.experiments = [];
  }

  return result;
}

export default { loadRuntimeContextInputs };
