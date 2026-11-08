/**
 * Context Graph Builder — canonical reconstruction from runtime state.
 *
 * Maps TaskState, RunState, and EvidenceLineage into a ContextGraph.
 */

import { ContextGraph } from "./context-graph.js";

/**
 * Builds a canonical ContextGraph from runtime state.
 *
 * @param {Object} taskState - Current task state
 * @param {Object} runState - Current run state
 * @param {Object} evidenceLineage - Evidence/verification state
 * @returns {ContextGraph}
 */
export function buildContextGraph(taskState, runState, evidenceLineage) {
  const g = new ContextGraph();

  // 1. Task Node
  const taskId = taskState?.taskId || null;
  if (taskId) {
    g.addNode({
      id: taskId,
      type: "task",
      content: taskState?.contract?.objective || "Active task",
      metadata: { provenance: "user_decided" },
    });
  }

  // 2. Requirement Nodes
  for (const req of taskState?.requirements || []) {
    if (!req?.id) continue;
    g.addNode({
      id: req.id,
      type: "requirement",
      content: req.title || req.description || "",
      verified:
        req.status === "done" ||
        req.status === "verified" ||
        req.verified === true,
      metadata: {
        provenance: "user_decided",
        status: req.status || "pending",
      },
    });
    // Task requires requirement (only if task node exists)
    if (taskId) {
      g.addEdge({
        from: taskId,
        to: req.id,
        type: "requires_completion",
      });
    }
  }

  // 3. Run State (actions, observations, decisions)
  const runId = runState?.id || runState?.runId || "run";
  const runText = (item, fallbackKey) => {
    if (typeof item === "string") return item;
    return (
      item?.description ||
      item?.summary ||
      item?.text ||
      item?.content ||
      item?.[fallbackKey] ||
      ""
    );
  };

  for (let i = 0; i < (runState?.actions || []).length; i += 1) {
    const action = runState.actions[i];
    if (action == null) continue;
    const id = action?.id || `${runId}-action-${i}`;
    g.addNode({
      id,
      type: "action",
      content: runText(action, "action"),
      createdAt: action?.createdAt || action?.timestamp || null,
      metadata: {
        provenance: "run_execution",
        createdAt: action?.createdAt || action?.timestamp || null,
      },
    });
    if (taskId) {
      g.addEdge({ from: id, to: taskId, type: "related_to" });
    }
  }

  for (let i = 0; i < (runState?.observations || []).length; i += 1) {
    const observation = runState.observations[i];
    if (observation == null) continue;
    const id = observation?.id || `${runId}-observation-${i}`;
    g.addNode({
      id,
      type: "observation",
      content: runText(observation, "observation"),
      createdAt:
        observation?.createdAt ||
        observation?.observedAt ||
        observation?.timestamp ||
        null,
      metadata: {
        provenance: "run_execution",
        createdAt:
          observation?.createdAt ||
          observation?.observedAt ||
          observation?.timestamp ||
          null,
      },
    });
    const target =
      observation?.requirementId && g.hasNode(observation.requirementId)
        ? observation.requirementId
        : taskId;
    if (target) {
      g.addEdge({ from: id, to: target, type: "related_to" });
    }
  }

  for (let i = 0; i < (runState?.decisions || []).length; i += 1) {
    const decision = runState.decisions[i];
    if (decision == null) continue;
    const id = decision?.id || `${runId}-decision-${i}`;
    g.addNode({
      id,
      type: "decision",
      content: runText(decision, "decision"),
      createdAt:
        decision?.madeAt ||
        decision?.createdAt ||
        decision?.timestamp ||
        null,
      metadata: {
        provenance: "run_execution",
        createdAt:
          decision?.madeAt ||
          decision?.createdAt ||
          decision?.timestamp ||
          null,
      },
    });
    const target =
      decision?.requirementId && g.hasNode(decision.requirementId)
        ? decision.requirementId
        : taskId;
    if (target) {
      g.addEdge({ from: id, to: target, type: "supports" });
    }
  }

  // 4. Evidence Lineage (mapped to canonical edges)
  for (const ev of evidenceLineage || []) {
    if (!ev?.id) continue;
    g.addNode({
      id: ev.id,
      type: "evidence",
      content: String(ev.content || "").slice(0, 500),
      verified: ev.status === "valid" || ev.verified === true,
      createdAt: ev.createdAt || ev.timestamp || null,
      metadata: {
        provenance: "run_execution",
        status: ev.status || null,
        createdAt: ev.createdAt || ev.timestamp || null,
      },
    });
    // Evidence supports requirement (only if requirement node exists)
    if (ev.requirementId && g.hasNode(ev.requirementId)) {
      g.addEdge({
        from: ev.id,
        to: ev.requirementId,
        type: "supports",
      });
    }
  }

  return g;
}
