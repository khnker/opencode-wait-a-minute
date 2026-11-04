/** Host adapter — drives the pure task loop and persists before prompting. */
import { decideNextAction, buildTaskLoopPrompt, TASK_LOOP_DECISIONS } from "../../execution/task-loop.js";
import { isTerminalAgentSignal } from "../../execution/agent-run-state.js";
import { migrateLegacyPhase } from "../../execution/execution-state.js";
import { evaluateCompletionGate } from "../../integration/orchestration.js";
import { getTaskState, persistTaskState } from "../../skills/engine.js";
import { collectTaskEvidence, evaluateEvidenceSufficiency, resolveQualityContract } from "../../quality/task-quality-contract.js";
import { normalizeSessionEvent } from "./event-normalizer.js";
import {
  createLoopState,
  loadLoopState,
  applyLoopDecision,
  recordLoopDecision,
  withLoopLock,
} from "../../state/loop-state.js";

export const DEFAULT_TASK_LOOP_CONFIG = Object.freeze({
  enabled: false,
  maxIterations: 10,
  maxNoProgress: 3,
});

const inFlight = new Set();
const ACTIONABLE = new Set(["CONTINUE", "REPLAN", "VERIFY"]);

export function buildLoopPrompt(result) {
  return buildTaskLoopPrompt(result);
}

export function driveTaskLoop({
  event = null,
  sessionId = null,
  projectRoot,
  taskId,
  turnId = null,
  client = null,
  config = DEFAULT_TASK_LOOP_CONFIG,
  qualityConfig = null,
  enforce = false,
  agent = null,
  now = Date.now(),
  deps = {},
} = {}) {
  const normalized = event ? normalizeSessionEvent(event) : null;
  if (event && !normalized) return { prompted: false, decision: null, reason: "not-session-idle" };

  const sid = sessionId || normalized?.sessionId || null;
  if (!sid || !taskId || !projectRoot) return { prompted: false, decision: null, reason: "incomplete-identity" };
  if (!config?.enabled) return { prompted: false, decision: null, reason: "disabled" };
  if (inFlight.has(sid)) return { prompted: false, decision: null, reason: "in-flight" };

  const loadTask = deps.loadTask || getTaskState;
  const evaluateGate = deps.evaluateGate || evaluateCompletionGate;
  const decide = deps.decide || decideNextAction;
  const loadLoop = deps.loadLoop || loadLoopState;
  const record = deps.record || recordLoopDecision;
  const persistTask = deps.persistTask || persistTaskState;

  try {
    return withLoopLock(taskId, projectRoot, () => {
      const task = loadTask(taskId, projectRoot);
      if (!task) return { prompted: false, decision: null, reason: "no-task" };

      const loaded = loadLoop(taskId, projectRoot);
      const loop = loaded?.state || createLoopState({
        taskId,
        sessionId: sid,
        maxIterations: config.maxIterations,
        maxNoProgress: config.maxNoProgress,
        now,
      });

      if (turnId && loop.lastTurnId === turnId) {
        return { prompted: false, decision: null, reason: "duplicate-turn", state: loop };
      }

      let quality = null;
      if (qualityConfig?.enabled === true) {
        const resolved = resolveQualityContract(task);
        const evaluation = evaluateEvidenceSufficiency(resolved, collectTaskEvidence(task), { now });
        quality = {
          enabled: true,
          kind: resolved.kind,
          sufficient: evaluation.sufficient,
          score: evaluation.score,
          missing: evaluation.missing,
          stale: evaluation.stale,
          contradictions: evaluation.contradictions,
          reasons: evaluation.reasons,
        };
      }

      const gateOptions = {};
      if (quality) gateOptions.quality = quality;
      if (enforce === true) gateOptions.enforce = true;
      const gate = evaluateGate(task, "", gateOptions) || {};
      const pending = Array.isArray(gate.pending) ? gate.pending : [];
      const taskState = task.state || migrateLegacyPhase(task.phase) || "INITIALIZING";
      const reqs = Array.isArray(task.requirements) ? task.requirements : [];
      const verified = reqs.filter((r) => r.status === "verified" || r.status === "done").length;
      const fingerprint = `${taskState}:${verified}/${reqs.length}:${pending.length}`;

      const progress = {
        advanced: loop.lastProgressFingerprint !== null && fingerprint !== loop.lastProgressFingerprint,
        regressed: deps.regressed === true,
        repeatedRejectedHypothesis: deps.repeatedRejectedHypothesis === true,
        fingerprint,
      };
      const authorization = {
        pendingAuth: task.pendingAuthorization || null,
        denied: task.pendingAuthorization?.status === "denied",
        contractApproved: task.contract?.status === "APPROVED" ? true : (task.contract?.status ? false : undefined),
      };
      const budget = {
        exhausted: (loop.iteration || 0) >= (loop.maxIterations ?? config.maxIterations),
      };

      const result = decide({ task, loop, progress, completionGate: gate, authorization, budget, quality: quality || {}, agent });
      if (!result?.decision || !TASK_LOOP_DECISIONS.includes(result.decision)) {
        throw new Error("session-driver: invalid loop decision");
      }

      const nextState = applyLoopDecision(loop, result, { turnId: turnId ?? loop.lastTurnId, now });
      const saved = record(taskId, projectRoot, nextState, result, {
        eventId: `${nextState.runId}:${nextState.sequence + 1}`,
        turnId,
        now,
        quality,
      });

      if (result.decision === "COMPLETE") {
        persistTask(
          taskId,
          { ...task, phase: "DONE", nextAction: "Tarea completa — contrato verificado" },
          projectRoot,
        );
      }

      const actionable = ACTIONABLE.has(result.decision);
      const surfaceable =
        result.decision === "WAIT_USER" ||
        result.decision === "WAIT_AUTHORIZATION" ||
        result.decision === "BLOCK" ||
        result.decision === "STOP_BUDGET" ||
        result.decision === "STOP_STAGNATION";
      const authToken =
        result.decision === "WAIT_AUTHORIZATION"
          ? task.pendingAuthorization?.id ?? "pending"
          : null;
      const surfaceByAgent =
        surfaceable &&
        result.decision !== "WAIT_AUTHORIZATION" &&
        isTerminalAgentSignal(agent);
      const stopDecision =
        result.decision === "STOP_BUDGET" || result.decision === "STOP_STAGNATION";
      const repeatedDecision = stopDecision
        ? loop.lastDecision === "STOP_BUDGET" || loop.lastDecision === "STOP_STAGNATION"
        : loop.lastDecision === result.decision;
      const needsUserSurface =
        surfaceable &&
        (surfaceByAgent
          ? agent.surfaced !== true
          : result.decision === "WAIT_AUTHORIZATION"
            ? task.authorizationSurfacedId !== authToken
            : !repeatedDecision);
      if ((!actionable && !needsUserSurface) || typeof client?.session?.prompt !== "function") {
        return { prompted: false, decision: result.decision, reason: result.reason, state: saved.state };
      }

      if (needsUserSurface) {
        try {
          if (surfaceByAgent) {
            persistTask(
              taskId,
              { ...task, agentRun: { ...(task.agentRun || {}), surfaced: true } },
              projectRoot,
            );
          } else if (result.decision === "WAIT_AUTHORIZATION") {
            persistTask(taskId, { ...task, authorizationSurfacedId: authToken }, projectRoot);
          }
        } catch {}
      }

      inFlight.add(sid);
      try {
        const call = client.session.prompt({
          sessionID: sid,
          path: { id: sid },
          query: { directory: projectRoot },
          body: buildLoopPrompt(result),
        });
        Promise.resolve(call).catch(() => {}).finally(() => inFlight.delete(sid));
      } catch (err) {
        inFlight.delete(sid);
        throw err;
      }
      return { prompted: true, decision: result.decision, reason: result.reason, state: saved.state };
    });
  } catch (error) {
    return { prompted: false, decision: null, reason: "error", error };
  }
}
