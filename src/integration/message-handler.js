/**
 * Runtime message handler — chat.message hook logic.
 *
 * Extracted from index.js to modularize the message processing pipeline.
 * Receives all dependencies via a `deps` object (inversion of control),
 * making it independently testable.
 *
 * Usage from index.js:
 *   "chat.message": (input, output) => handleMessage(input, output, deps),
 *
 * where `deps` contains everything the handler needs (see DEPENDENCIES
 * section in the typedef below for the full list).
 */

import fs from "node:fs";
import path from "node:path";

import { hasWamMarkerFor, injectWamParts, isWamSynthetic } from "./part-provenance.js";
import { ensurePermissionPlan, permissionPreflightLines } from "../policy/permission-preflight.js";
import { buildTaskInferenceDirective } from "../cognition/task-inference-engine.js";
import { buildRoleDirective } from "../cognition/task-role-engine.js";
import { detectCouplingIntent, traceCouplingForTask } from "../context/selection.js";
import { loadPrompt } from "../prompts/loader.js";
import { confirmCompletion } from "../verification/verification-policy.js";
import { validateState } from "../state/task-state.js";
import { buildCompletionValidation } from "./orchestration.js";
import { pruneCompletedTasks } from "../persistence/retention-manager.js";
import { classifyIntentLane, INTENT_LANES } from "../policy/intent-router.js";
import { observeDialogueTurn } from "../dialogue/index.js";
import { getIntentDictionary, saveIntentDictionary } from "../dialogue/intent-dictionary.js";
import { loadHistoryEntries, retrieveIntentHistory } from "../context/intent-history.js";
import { applyContextBudget } from "../context/context-budget.js";
import { filterNewContext } from "../context/context-dedupe.js";
import { recordContextPack, recordDelegationEvidence, injectedSkillIds } from "../context/context-pack-evidence.js";
import { activeTaskPath } from "../shared/wam-paths.js";
import { loadConversationMemory, recordTurn, formatMemoryForContext } from "../persistence/conversation-memory.js";

const SESSION_INJECTED_SKILLS = new Map();
const MAX_TRACKED_SESSIONS = 200;

const WAM_BLOCK_START = "[wam][start]";
const WAM_BLOCK_END = "[wam][end]";

export function wrapWamBlock(text) {
  const body = String(text || "").trim();
  if (!body) return "";
  if (body.startsWith(WAM_BLOCK_START) && body.endsWith(WAM_BLOCK_END)) return body;
  return `${WAM_BLOCK_START}\n${body}\n${WAM_BLOCK_END}`;
}

export function mergeValidationLines(inject, validation) {
  const lines = (validation?.validationLines || []).filter(
    (line) => typeof line === "string" && line.trim()
  );
  if (lines.length > 0) inject.push(...lines);
  return lines.length > 0;
}

function injectedSkillsFor(sessionID) {
  if (!sessionID) return new Set();
  let set = SESSION_INJECTED_SKILLS.get(sessionID);
  if (!set) {
    set = new Set();
    SESSION_INJECTED_SKILLS.set(sessionID, set);
    if (SESSION_INJECTED_SKILLS.size > MAX_TRACKED_SESSIONS) {
      SESSION_INJECTED_SKILLS.delete(SESSION_INJECTED_SKILLS.keys().next().value);
    }
  }
  return set;
}

// Idempotency guard: a chat.message invocation must be processed at most once
// per message id + kind. The store is normally owned by the plugin instance
// (deps.processedMessages); the module-level fallback keeps direct callers and
// tests working. Bounded so a long session cannot grow unbounded.
const PROCESSED_MESSAGE_LIMIT = 1000;
const fallbackProcessedMessages = new Map();

// Sesiones a las que ya se les emitió el saludo de bienvenida/desambiguación.
// Evita emitir el notice en cada continuación de la misma sesión; solo se
// dispara una vez cuando la primera inferencia cayó en namespace genérico.
const greetedSessions = new Set();

function markProcessed(key, store = fallbackProcessedMessages) {
  store.set(key, true);
  if (store.size > PROCESSED_MESSAGE_LIMIT) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
}

export function _resetProcessedMessages(store = fallbackProcessedMessages) {
  store.clear();
}

/**
 * Pure predicate: true when this message was already handled by WAM.
 * Serves as the runtime guard and as a testable unit.
 *
 * @param {Object} input
 * @param {Object} output
 * @param {Map} [store]
 * @returns {boolean}
 */
export function isMessageAlreadyProcessed(input, output, store = fallbackProcessedMessages) {
  const messageId = input?.messageID || output?.message?.id || input?.message?.id || null;
  if (!messageId) return false;
  const key = `${messageId}:${input?.tool ? "tool" : "prompt"}`;
  return (
    store.has(key) ||
    hasWamMarkerFor(output?.parts, messageId) ||
    hasWamMarkerFor(input?.message?.parts, messageId)
  );
}

// Generic/new task ids must never be treated as explicit task identity.
// Kept in sync with index.js GENERIC_TASK.
const GENERIC_TASK = /^(default-task|task|general|)$/;

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const RESUME_RE = /\b(en qué estábamos|en que estabamos|dónde íbamos|donde íbamos|sigamos|continuemos|retomar la tarea)\b/i;
const MAX_VISIBLE_REQS = 5;
const ASKING_CMD_RE = /^(answer|resolve|contract|progress|task|skills|assumptions|compress)\b/;

// ---------------------------------------------------------------------------
// DEPENDENCIES (provided by caller via deps parameter)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MessageHandlerDeps
 * @property {boolean} bypassed
 * @property {Map}    sessionTasks
 * @property {Map}    sessionStore
 * @property {Object} cfg
 * @property {Function} resolveSessionBase
 * @property {Function} wamRootFor
 * @property {Function} ensureWamMemory
 * @property {Function} effectiveTaskId
 * @property {Function} genPartId
 * @property {Map}      [processedMessages]
 * @property {Function} emitTextPart
 * @property {Function} readActiveTaskIdFresh
 * @property {Function} writeActiveTaskId
 * @property {Object}   waitAMinute
 * @property {Function} getTaskState
 * @property {Function} persistTaskState
 * @property {Function} findDuplicateTask
 * @property {Function} escalateAssumptions
 * @property {Function} buildAssumptions
 * @property {Function} initMemory
 * @property {Function} updateProjectMemo
 * @property {Function} updateLiveContext
 * @property {Function} readLiveContext
 * @property {Function} persistLiveContext
 * @property {Function} assembleContext
 * @property {Function} createSnapshot
 * @property {Function} checkContinuation
 * @property {Function} rebuildScope
 * @property {Function} getDecision
 * @property {Function} recordDecision
 * @property {Function} compactDecisions
 * @property {Function} writeCavemanSummary
 * @property {Function} truncate
 * @property {Function} delegationLines
 * @property {Function} updateTaskMemory
 * @property {Function} addRecentChange
 * @property {Function} closeSession
 * @property {Function} getSessionId
 * @property {Function} classifyAskingMessage
 */

/**
 * Handles the chat.message hook: deterministic task-state and context analysis of user messages.
 *
 * @param {Object} input  - OpenCode chat.message input
 * @param {Object} output - OpenCode chat.message output (mutated in place)
 * @param {MessageHandlerDeps} deps
 * @returns {Promise<void>}
 */
export async function handleMessage(input, output, deps) {
  const {
    collector = null,
    bypassed,
    sessionBypasses,
    sessionTasks,
    sessionStore,
    cfg,
    resolveSessionBase,
    wamRootFor,
    ensureWamMemory,
    effectiveTaskId,
    isSubagentSession,
    getRequestUsage,
    isContinuationPrompt,
    genPartId,
    emitTextPart,
    readActiveTaskIdFresh,
    writeActiveTaskId,
    waitAMinute,
    getTaskState,
    persistTaskState,
    findDuplicateTask,
    escalateAssumptions,
    buildAssumptions,
    initMemory,
    updateProjectMemo,
    updateLiveContext,
    readLiveContext,
    persistLiveContext,
    assembleContext,
    selectContextWithCqe,
    detectFileSearchIntent,
    createSnapshot,
    checkContinuation,
    rebuildScope,
    getDecision,
    recordDecision,
    compactDecisions,
    writeCavemanSummary,
    truncate,
    delegationLines,
    updateTaskMemory,
    addRecentChange,
    closeSession,
    getSessionId,
    classifyAskingMessage,
  } = deps;

  try {
    const sid = input?.sessionID;
    if (bypassed || (sid && sessionBypasses?.has(sid))) return;

    // Idempotency: never process the same message twice. WAM injects synthetic
    // parts into `output`; without this guard a re-invocation (retry/replay)
    // would read its own injection as a fresh prompt and loop indefinitely.
    const processedStore = deps.processedMessages || fallbackProcessedMessages;
    if (isMessageAlreadyProcessed(input, output, processedStore)) return;
    {
      const messageId = input?.messageID || output?.message?.id || input?.message?.id || null;
      if (messageId) markProcessed(`${messageId}:${input?.tool ? "tool" : "prompt"}`, processedStore);
    }

    const promptText = extractPrompt(input, output);
    if (!promptText.trim()) return;

    // Ensure WAM memory for this session
    const wamRoot = await ensureWamMemory(input.sessionID, promptText);

    // No-task-assumption: resume intent without active task → ask, don't assume
    if (!input.taskId && RESUME_RE.test(promptText)) {
      const active = sessionTasks.get(input.sessionID) || readActiveTaskIdFresh(wamRoot);
      const st = active ? getTaskState(active, wamRoot) : null;
      if (st && st.phase !== "DONE") {
        emitTextPart(output, loadPrompt("notice.pending_task", { active, phase: st.phase }), { sessionID: input.sessionID, messageID: output.message?.id || input.messageID });
      } else {
        emitTextPart(output, loadPrompt("notice.no_active_task"), { sessionID: input.sessionID, messageID: output.message?.id || input.messageID });
      }
      return;
    }

    // Effective taskId with session persistence.
    // promptText is passed so a brand-new session can derive a descriptive
    // task-<slug> id from the user's prompt instead of falling back to the
    // monolithic ses-<sessionID> / default-task namespaces.
    let taskId, fallbackKind;
    {
      const resolved = effectiveTaskId(input, sessionTasks, wamRoot, promptText, typeof isSubagentSession === "function" ? isSubagentSession(input?.sessionID) : false);
      taskId = resolved.taskId;
      fallbackKind = resolved.fallbackKind;
    }
    if (input.sessionID) {
      sessionTasks.set(input.sessionID, taskId);
      // Persist active-task pointer to disk so /wam contract approve (which
      // runs in a different process after restart) resolves the SAME taskId
      // instead of falling back to ses-<sid>/default-task and approving the
      // wrong task. Se persiste en slug-session-bound (nueva task), cached y
      // active (refresh: el binding 1 sesión = 1 task nunca debe expirar por
      // falta de escritura). Namespaces genéricos (session/default) son
      // deterministas y no necesitan persistencia.
      if ((fallbackKind === "slug-session-bound" || fallbackKind === "cached" || fallbackKind === "active") && typeof writeActiveTaskId === "function") {
        try {
          writeActiveTaskId(taskId, wamRoot, { sessionId: input.sessionID, projectRoot: wamRoot });
        } catch (err) {
          // Non-fatal: keep in-memory cache so the session keeps working,
          // but log so the persistence gap is visible.
          if (typeof deps?.wamWarn === "function") deps.wamWarn(`[WAM] active-task persist failed: ${err.message}`);
        }
      }
    } else if (fallbackKind === "slug-session-bound") {
      // Slug fallback produced a nosess suffix because sessionID was missing.
      // Log a warning so silent cross-session collision risks are visible.
      if (typeof deps?.wamWarn === "function") deps.wamWarn(`[WAM] slug-session-bound task ${taskId} created without sessionID — re-binding on next message will fail`);
    }

    // Task-start gate: cada vez que parte una tarea se valida el task y se
    // podan las carpetas con más de 15 días (soft-archive: el resumen queda
    // en `.wam/archive/tasks/`, nunca se borra el archive). Best-effort:
    // jamás bloquea el flujo del mensaje.
    try {
      const existing = getTaskState(taskId, wamRoot);
      if (existing) validateState(existing);
    } catch {}
    try { pruneCompletedTasks(wamRoot).catch(() => {}); } catch {}

    // Welcome / disambiguation gate: cuando la primera inferencia cayó en
    // default-task o ses-<id> sin pista específica, saludamos al usuario y
    // le pedimos que describa la tarea para sacarlo del namespace genérico.
    // Solo se emite una vez por sessionID (no en cada continuación).
    // Silenciado por defecto para reducir fricción; habilitar con cfg.verboseWelcome
    const shouldGreet =
      !input?.tool &&
      !isContinuationPrompt(promptText) &&
      input.sessionID &&
      !greetedSessions.has(input.sessionID) &&
      cfg?.verboseWelcome === true;
    if (shouldGreet) {
      const greeting = loadPrompt("notice.welcome_or_disambiguate", {
        kind: fallbackKind,
        namespace: taskId,
      });
      const result = emitTextPart(output, greeting, {
        sessionID: input.sessionID,
        messageID: output.message?.id || input.messageID,
      });
      if (result && result.status === "inserted") {
        greetedSessions.add(input.sessionID);
      }
    }

    // Clarification Gate: in ASKING classify the message
    const askingState = getTaskState(taskId, wamRoot);
    if (askingState?.phase === "ASKING") {
      const trimmed = promptText.trim();
      if (ASKING_CMD_RE.test(trimmed)) return; // handled by command.execute.before
      const kind = classifyAskingMessage(trimmed);
      if (kind === "blocked-message") {
        const u = (askingState.contract?.unknowns || []).find((x) => x.status === "blocking");
        const directive = u
          ? loadPrompt("notice.blocked_question", { id: u.id, question: u.question })
          : loadPrompt("notice.blocked_generic");
        emitTextPart(output, directive, { sessionID: input.sessionID, messageID: output.message?.id || input.messageID });
        // Rewrite the original prompt so the implementation attempt is NOT
        // consumed downstream as an instruction (AC5).
        const rewrite = loadPrompt("notice.blocked_prefix", { directive });
        // SDK 1.19: output.parts holds the user text — rewrite there so the
        // implementation attempt is NOT consumed downstream as an instruction.
        // Prefix the rewrite (do NOT append) so the original prompt cannot be
        // re-interpreted as a directive by a downstream LLM (AC5).
        if (Array.isArray(output?.parts) && output.parts.length > 0) {
          const tp = output.parts.find(
            (p) => p && p.type === "text" && typeof p.text === "string" && !isWamSynthetic(p),
          );
          if (tp) tp.text = rewrite + "\n\n" + tp.text;
        }
        if (input?.message?.parts && input.message.parts.length > 0) {
          const tp = input.message.parts.find((p) => p.type === "text" && typeof p.text === "string");
          if (tp) tp.text = rewrite + "\n\n" + tp.text;
        }
        if (input?.parts && input.parts.length > 0) {
          const tp = input.parts.find((p) => p.type === "text" && typeof p.text === "string");
          if (tp) tp.text = rewrite + "\n\n" + tp.text;
        }
        return;
      }
      if (kind === "new-intent") {
        emitTextPart(output, loadPrompt("notice.new_intent"), { sessionID: input.sessionID, messageID: output.message?.id || input.messageID });
        // Override the explicit taskId so subsequent analysis creates a fresh
        // task (task-<ts>) without contaminating unknowns from the previous task.
        const newTaskId = `task-${Date.now()}`;
        if (input) input.taskId = newTaskId;
        try {
          if (input?.sessionID) sessionTasks.set(input.sessionID, newTaskId);
          writeActiveTaskId(newTaskId, wamRoot);
        } catch {}
        // Update local taskId so the rest of handleMessage uses the new task.
        taskId = newTaskId;
        // Fall through to normal analysis: a new task-<ts> task gets created.
      }
      // answer: in ASKING a natural-language message resolves the blocking question.
      const ansRes = waitAMinute.answerFromMessage(taskId, trimmed, wamRoot);
      if (ansRes && ansRes.ok) {
        const u = ansRes.u;
        emitTextPart(
          output,
          loadPrompt("notice.question_answered", {
            id: u?.id || "U1",
            answer: u?.answer || trimmed,
            question: u?.question || "pregunta resuelta",
          }),
          { sessionID: input.sessionID, messageID: output.message?.id || input.messageID },
        );
        // After resolving, fall through to re-analysis so contract is rebuilt.
      }
    }

    // Project scope change → backlog + new task
    const existingState = getTaskState(taskId, wamRoot);
    if (existingState?.projectPath && existingState.projectPath !== wamRoot) {
      waitAMinute.addToBacklog(
        existingState,
        `Task ${taskId}: ${existingState.contract?.requirements?.map((r) => r.title).join("; ") || "sin reqs"}`,
        "project-switch",
      );
      persistTaskState(taskId, existingState, wamRoot);
      try { fs.rmSync(activeTaskPath(wamRoot), { force: true }); } catch {}
      taskId = `task-${Date.now()}`;
      input.taskId = taskId;
    }

    // Continuation fast-path: approved contract + no DONE claim
    if (existingState?.contract?.status === "APPROVED") {
      // For non-DONE messages, skip the gate entirely. For DONE messages,
      // run the gate; if it reports an advisory (requirements still pending)
      // we fall through so the recommendation notice is emitted. On a VALID
      // snapshot we emit the N2 task delta and return.
      const isDoneClaim = waitAMinute.isCompletionIntent(promptText);
      const claim = isDoneClaim
        ? waitAMinute.evaluateCompletionGate(existingState, promptText)
        : { blocked: false };
      const isContinuation = !isDoneClaim || claim.allDone === true;
      if (isContinuation) {
        const snapshotCheck = checkContinuation(taskId, existingState, wamRoot);
        if (snapshotCheck.status === "VALID") {
          if (collector) collector.record("Context_fast_path");
          input.waitAnalysis = sessionStore.get(`${input.sessionID}:waitAnalysis`) || null;
          try { updateProjectMemo({}, wamRoot); } catch {}
          try {
            persistLiveContext(taskId, existingState, wamRoot);
            const live = readLiveContext(wamRoot, taskId);
            const parts = [
              loadPrompt("injection.continuation", {
                signals: snapshotCheck.changedSignals?.join(", ") || "no-changes",
              }) + "\n",
              loadPrompt("injection.n2_task", { live }) + "\n",
            ];
            const delegation = delegationLines(existingState);
            parts.push(...delegation.map((l) => l + "\n"));
            try { recordDelegationEvidence({ taskId, lines: delegation, root: wamRoot }); } catch {}
            const dedupedParts = filterNewContext(parts, {
              root: wamRoot,
              sessionID: input.sessionID,
            });
            if (dedupedParts.length > 0) {
              emitTextPart(output, dedupedParts.join("\n"), { sessionID: input.sessionID, messageID: output.message?.id || input.messageID });
            }
          } catch {}
          return;
        }
        // INVALID: full rebuild → fall through to normal analyze()
      }
    }

    // ---- Normal analysis flow ----
    const analysis = await waitAMinute.analyze({
      prompt: promptText,
      projectPath: wamRoot,
      config: cfg,
      tierCaps: cfg.tierCaps,
      activePreset: cfg.activePreset,
      activeMode: cfg.activeMode,
    });

    const state = waitAMinute.buildPersistedState(taskId, analysis, wamRoot);
    state.lastAction = promptText;
    const intentLane = classifyIntentLane(promptText, {
      phase: state.phase,
      contractStatus: state.contract?.status,
      hasActiveTask: Boolean(existingState?.requirements?.length || state.requirements?.length),
    });

    let dialogueTurn = null;
    try {
      const dictionary = getIntentDictionary(wamRoot);
      dialogueTurn = await observeDialogueTurn({
        message: promptText,
        taskState: state,
        dictionary,
        complete: deps.dialogueComplete || null,
      });
      state.dialogue = dialogueTurn.state;
      if (dialogueTurn.learned) saveIntentDictionary(wamRoot, dictionary);
      if (state.requirements?.length) persistTaskState(taskId, state, wamRoot);
    } catch (err) {
      if (typeof deps.wamWarn === "function") {
        deps.wamWarn(`[WAM] dialogue observer failed: ${err.message}`);
      }
    }

    // Task Dedup - CANDIDATE ONLY: never overrides taskId implicitly.
    // - If input.taskId is explicit → NEVER override; do NOT even consult findDuplicateTask
    // - If taskId is generic/new → findDuplicateTask may return a candidate
    //   but is reported, not assigned; caller decides via /wam task switch
    const isExplicit = input?.taskId && !GENERIC_TASK.test(input.taskId);
    if (!isExplicit) {
      const existingTaskId = findDuplicateTask(promptText, wamRoot);
      if (existingTaskId && existingTaskId !== taskId) {
        // Candidate-only: report, do not reassign. The session continues with
        // the freshly-initialized taskId; the user can reuse via /wam task switch.
        emitTextPart(output, loadPrompt("notice.similar_task", { taskId: existingTaskId }), { sessionID: input.sessionID, messageID: output.message?.id || input.messageID });
      }
    }

    // Assumption Gate
    try {
      const { changed } = escalateAssumptions(state, promptText);
      if (changed) persistTaskState(taskId, state, wamRoot);
    } catch (err) {
      console.error("[wait-a-minute] escalate assumptions failed:", err);
    }

    // Store analysis in session
     sessionStore.set(`${input.sessionID}:waitAnalysis`, analysis);
     sessionStore.set(`${input.sessionID}:completionContract`, state.contract);
     sessionStore.set(`${input.sessionID}:persistentPolicies`, analysis.persistentPolicies || []);
     sessionStore.set(`${input.sessionID}:skillRegistry`, analysis.skillRegistry || {});

    // Blocking questions → ASKING
    // Router dispatches already carry an explicit plan from the orchestrator:
    // they must never be parked in ASKING by inferred assumptions.
    const delegatedDispatch = /^\s*\[router\]/i.test(promptText);
    const blockingUnknowns = delegatedDispatch ? [] : (state.contract?.unknowns || []).filter((u) => u.status === "blocking");
    const finalQuestions = blockingUnknowns.filter((u) => {
      const decision = getDecision(u.id, wamRoot);
      if (decision) { console.log(`[wait-a-minute] Found existing decision for ${u.id}: ${decision.decision}`); return false; }
      return true;
    });

    if (finalQuestions.length > 0 && state.phase !== "ANSWERED") {
      state.phase = "ASKING";
      state.nextAction = "Responder pregunta bloqueante antes de ejecutar";
      persistTaskState(taskId, state, wamRoot);
      const questions = [];
      for (const u of finalQuestions) {
        questions.push(`⛔ [wait-a-minute] ASKING — ${u.id}: ${u.question}\nNo implementar hasta responder. Responder: /wam answer ${u.id} <respuesta>`);
      }
      emitTextPart(output, questions.join("\n\n"), { sessionID: input.sessionID, messageID: output.message?.id || input.messageID });
      return;
    }

    // Approval gate
    const earlyNotices = [];
    const intentConf = Number(analysis.intent?.confidence ?? analysis.intent?.conf ?? 100);
    const openUnknowns = (state.contract?.unknowns || []).filter((u) => u.status !== "answered" && u.status !== "blocking");
    const highUncertainty =
      (analysis.ambiguity || "low") === "high" ||
      intentConf < 60 ||
      openUnknowns.length > 0;
    const trimmed = promptText.trim();

    // 0 fricción: un contrato propuesto nunca pide confirmación — se emite una
    // recomendación y se procede. Solo /wam contract edit modifica el contrato.
    if (
      state.contract?.status === "PROPOSED" &&
      state.phase === "PROPOSED" &&
      !state.contractPrompted
    ) {
      const reqCount = (state.contract?.requirements || []).length;
      earlyNotices.push(`Recomendación: contrato propuesto (${reqCount} requisitos) — procedo; /wam contract edit si algo no coincide.`);
      state.contractPrompted = true;
      try { persistTaskState(taskId, state, wamRoot); } catch {}
    }

    const isCompletionClaim = waitAMinute.isCompletionIntent(promptText);
    const dialogueIntent = dialogueTurn?.observation?.intent;
    const isTrivialAnalysis =
      !isCompletionClaim &&
      (intentLane.lane === INTENT_LANES.CONVERSATION ||
        dialogueIntent === "META" ||
        dialogueIntent === "CLARIFY" ||
        analysis.intent?.classification === "trivial" ||
        analysis.strategy === "FAST");
    const gate = isTrivialAnalysis
      ? { blocked: false, allDone: false }
      : waitAMinute.evaluateCompletionGate(state, promptText);
    // Anti-tampering: only mutate persisted state when the prompt actually
    // asserts completion intent. The gate always evaluates real state now, so
    // this guard guarantees a normal message never mutates phase/nextAction.
    if (!isTrivialAnalysis && waitAMinute.isCompletionIntent(promptText) && (gate.advisory || gate.allDone)) {
      const { phase, nextAction } = waitAMinute.applyPhaseTransition(state, gate);
      state.phase = phase;
      state.nextAction = nextAction;
      persistTaskState(taskId, state, wamRoot);
    }

    const updatedState = getTaskState(taskId, wamRoot) || state;

    // Final completion message: emit once when the gate allows DONE.
    if (
      !isTrivialAnalysis &&
      gate.allDone &&
      updatedState.phase === "DONE" &&
      !updatedState.completionNotified &&
      waitAMinute.isCompletionIntent(promptText)
    ) {
      const verified = (updatedState.requirements || []).filter((r) => r.status === "verified");
      const evidence = verified
        .flatMap((r) => (r.evidence || []).map((e) => (typeof e === "string" ? e : e?.description || e?.summary || "")))
        .filter(Boolean)
        .slice(0, 5);
      const notice = loadPrompt("notice.task_complete", {
        objective: updatedState.contract?.objective || state.contract?.objective || "—",
        count: verified.length,
        evidence: evidence.join("; ") || "—",
        artifacts: `.wam/tasks/${taskId}/summary.md, recent-changes.md`,
      });
      emitTextPart(output, notice, {
        sessionID: input.sessionID,
        messageID: output.message?.id || input.messageID,
      });
      updatedState.completionNotified = true;
      try { persistTaskState(taskId, updatedState, wamRoot); } catch {}
    }

    // Snapshot the persisted state so the next continuation can use the fast-path.
    try { createSnapshot(taskId, updatedState, wamRoot); } catch {}

    // Live context snapshot
    try { persistLiveContext(taskId, updatedState, wamRoot); } catch {}

    // ---- Context Assembly ----
    const inject = [...earlyNotices];
    const contextInject = [];
    const auxInject = [];

    if ((intentLane.lane === INTENT_LANES.TASK_NEW || intentLane.lane === INTENT_LANES.CORRECTION) && !waitAMinute.isCompletionIntent(promptText)) {
      try {
        const history = retrieveIntentHistory(
          loadHistoryEntries(wamRoot, { taskId }),
          promptText,
          { limit: 3, threshold: 0.35 }
        );
        if (history.length) {
          auxInject.push(
            `[wam history]\n${history
              .map((h) => `- (${h.source}) ${String(h.text || "").replace(/\s+/g, " ").slice(0, 200)}`)
              .join("\n")}\n`
          );
        }
      } catch {}
      try {
        const memory = loadConversationMemory(wamRoot, input.sessionID);
        const memoryText = formatMemoryForContext(memory, promptText, 3);
        if (memoryText) auxInject.push(`[wam memory]\n${memoryText}\n`);
      } catch {}
    }

    const reqs = updatedState.requirements || [];
    const pend = reqs.filter((r) => r.status !== "done" && r.status !== "verified");
    const objective = updatedState.contract?.objective || analysis.intent?.goal || null;
    if (intentLane.lane !== INTENT_LANES.CONVERSATION) {
      if (updatedState.phase === "PROPOSED" && !updatedState.contractDisplayed) {
        const visible = reqs.slice(0, MAX_VISIBLE_REQS);
        const overflow = reqs.length - MAX_VISIBLE_REQS;
        inject.push(
          `Objective: ${objective || "pending"}`,
          `Remaining (${pend.length}/${reqs.length}):`,
          ...visible.map((r) => `  - ${truncate(r.title, 120)}`),
          ...(overflow > 0 ? [`  ... y ${overflow} más`] : []),
        );
        updatedState.contractDisplayed = true;
        persistTaskState(taskId, updatedState, wamRoot);
      }
    }

    try { initMemory(wamRoot); } catch {}
    try { updateProjectMemo(analysis, wamRoot); } catch {}
    const requestUsage = typeof getRequestUsage === "function" ? getRequestUsage(input?.sessionID) : null;
    const injectedSkills = cfg.skillDedupe === false ? null : injectedSkillsFor(input?.sessionID);
    if (injectedSkills && injectedSkills.size === 0) {
      for (const id of injectedSkillIds({ taskId, root: wamRoot })) injectedSkills.add(id);
    }
    try {
      const pack = await assembleContext({
        prompt: promptText,
        taskId,
        classification: analysis.intent?.classification,
        mode: analysis.strategy,
        projectPath: wamRoot,
        budget: cfg.contextBudget || 16000,
        taskState: updatedState,
        skillRegistry: cfg.skills === false ? {} : (analysis.skillRegistryMap || waitAMinute.loadBundledRegistry()),
        selectedSkills: analysis.skills?.selected || [],
        injectedSkills,
        previousRequestTokens: requestUsage,
      });
      if (pack.lines.length) {
        contextInject.push(pack.lines.join("\n") + "\n");
      }
      try { recordContextPack({ taskId, prompt: promptText, pack, root: wamRoot }); } catch {}
      // Expone skillStates para trazabilidad / tests (A, E).
      try {
        sessionStore.set(`${input.sessionID}:skillStates`, pack.skillStates || []);
      } catch {}

      if (detectCouplingIntent(promptText)) {
        const couplingPack = await traceCouplingForTask(promptText, { root: wamRoot });
        if (couplingPack.ok && couplingPack.lines.length > 0) {
           contextInject.push(couplingPack.lines.join("\n") + "\n");
        }
      }

      if (detectFileSearchIntent(promptText)) {
        const cqeT0 = Date.now();
        const cqePack = await selectContextWithCqe(promptText, {
          root: wamRoot,
          disableCqe: cfg.disableCqe === true,
        });
        const cqeMeta = cqePack.cqeMeta || {};
        const cqeMs = typeof cqeMeta.elapsedMs === "number" ? cqeMeta.elapsedMs : Date.now() - cqeT0;
        const cqeFiles = Array.isArray(cqePack.file_context) ? cqePack.file_context : [];
        if (cqeFiles.length > 0) {
          const shown = cqeFiles.slice(0, 8).map((f) => {
            const score = f?.score ?? f?.relevance ?? "?";
            const toks = f?.tokenEstimate ?? "?";
            const snippet = String(f?.content || "").replace(/\n+/g, " ").slice(0, 120);
            const loc = f?.startLine != null ? `:${f.startLine}` : "";
            return `  - ${f?.path || "?"}${loc} (score ${score}, ~${toks} tok) ${snippet}`;
          });
          if (cqeFiles.length > 8) shown.push(`  ... (+${cqeFiles.length - 8} más)`);
          contextInject.push(`\n[wam cqe file_context: ${cqeFiles.length} archivos en ${cqeMs}ms, fuente ${cqeMeta.source || "?"}]\n${shown.join("\n")}`);
          contextInject.push(`cqe: ${cqeFiles.length} archivos en ${cqeMs}ms (fuente ${cqeMeta.source || "?"}) — top: ${(cqeFiles.slice(0, 3).map((f) => f?.path || "?")).join(", ")}`);
        } else {
          const reason = cqeMeta.fallbackReason || (cqeMeta.cqeError ? `error: ${cqeMeta.cqeError}` : "sin resultados");
          contextInject.push(`[wam cqe] sin resultados (${reason}) en ${cqeMs}ms — contexto nativo prevalece`);
        }
        if (cqePack.cqeMeta) {
          const cqeTarget = updatedState || state;
          if (cqeTarget) {
            cqeTarget.cqeCalls = (cqeTarget.cqeCalls || 0) + 1;
            try { persistTaskState(taskId, cqeTarget, wamRoot); } catch {}
          }
        }
      }
    } catch {}

    // Directive inference
    if (updatedState.contract?.objective && updatedState.phase !== "DONE" && analysis.intent?.classification !== "trivial") {
      if (!updatedState.inferenceDirectiveShown) {
        try {
const { lines } = buildTaskInferenceDirective({
            objective: updatedState.contract.objective,
            requirements: updatedState.requirements
          });
          if (lines.length > 0) {
            inject.push(...lines);
            updatedState.inferenceDirectiveShown = true;
          }
          // Role-conditioned directive: pair with the task inference directive
          // so the injected context uses the right voice (verifier, reviewer,
          // operator, planner, implementer, doc-writer). Idempotent — same
          // shape as buildTaskInferenceDirective so callers can concat safely.
          const role = buildRoleDirective({
            objective: updatedState.contract.objective,
            requirements: updatedState.requirements,
          });
          if (role.lines.length > 0) {
            inject.push(...role.lines);
          }
          persistTaskState(taskId, updatedState, wamRoot);
        } catch (e) {
          console.error("Failed to build task inference directive:", e);
        }
      }
    }


    if (isCompletionClaim && gate.advisory) {
      const maxGateReqs = 5;
      const pendingItems = gate.pending || [];
      const gateKey = pendingItems.join("|");
      const repeat = gateKey && updatedState.completionGateKey === gateKey;
      if (!repeat) {
        const visiblePending = pendingItems.slice(0, maxGateReqs);
        const overflowPending = pendingItems.length - maxGateReqs;
        const pendingList = visiblePending.length > 0
          ? "Requisitos pendientes:\n" + visiblePending.map((p) => `- ${truncate(p, 150)}`).join("\n") + (overflowPending > 0 ? `\n(...(+${overflowPending} más))` : "")
          : "";
        const gateHold = loadPrompt("notice.completion_gate", { count: gate.pending.length, pendingList, nextAction: updatedState.nextAction });
        emitTextPart(output, gateHold, { sessionID: input.sessionID, messageID: output.message?.id || input.messageID });
        // La validación viaja al LLM como parte propia (no como reescritura del
        // mensaje del usuario): el modelo debe continuar con el objetivo del
        // contrato en vez de re-declarar DONE.
        const validation = buildCompletionValidation(gate, updatedState);
        injectWamParts(
          output,
          [{ id: genPartId(), type: "text", text: validation.text }],
          { messageID: output.message?.id || input.messageID, sessionID: input.sessionID, phase: "gate-validation", idFactory: genPartId, position: "append" },
        );
        updatedState.completionGateKey = gateKey;
        persistTaskState(taskId, updatedState, wamRoot);
      }
      // Mismo set de pendientes que el turno anterior: no repetir el aviso.
      // -------------------------------------------------------------
    } else if (isCompletionClaim && gate.allDone) {
      try {
        confirmCompletion(updatedState, {
          projectRoot: wamRoot,
          logger: { log: (msg) => inject.push(msg) },
        });
      } catch (e) {
        console.error("confirmCompletion failed:", e);
      }
      updateTaskMemory(taskId, {
        summary: [
          "# Task Summary", "", "## Objective",
          `- ${taskId} (${analysis.intent?.classification || "task"})`, "", "## Completed",
          ...(updatedState.contract?.requirements || []).map((r) => `- ${r}`), "", "## Verification",
          ...(updatedState.requirements || []).map((r) => `- ${r.id}: ${r.status}`), "", "## Token Savings",
          `- CQE file-context calls: ${updatedState.cqeCalls || 0}`, "", "## Status", "COMPLETED",
        ].join("\n"),
      }, wamRoot);
      addRecentChange({
        date: new Date().toISOString().slice(0, 10),
        scope: taskId,
        changes: updatedState.contract?.requirements || [],
        verification: `requisitos completos: ${(updatedState.requirements || []).length}`,
      }, wamRoot);
      try {
        writeCavemanSummary(taskId, updatedState, wamRoot, [
          "date:", new Date().toISOString().slice(0, 10),
          "scope:", taskId,
          "status:", "COMPLETED",
          "completed:",
          ...(updatedState.contract?.requirements || []).map((r) => `- ${r}`),
          "verification:",
          ...(updatedState.requirements || []).map((r) => `- ${r.id}: ${r.status}`),
        ].join("\n"));
      } catch {}
      try {
        closeSession({
          sessionId: getSessionId(wamRoot),
          taskId,
          summary: (updatedState.contract?.requirements || []).join("; "),
          candidates: (updatedState.requirements || []).map((r) => ({ id: r.id, title: r.title, evidence: r.evidence || [] })),
        }, wamRoot);
      } catch {}
    }

    if (updatedState.contract?.status === "APPROVED") {
      const delegation = delegationLines(updatedState);
      inject.push(...delegation);
      try { recordDelegationEvidence({ taskId, lines: delegation, root: wamRoot }); } catch {}
      const preflight = ensurePermissionPlan(updatedState, { promptText });
      if (preflight) {
        const lines = permissionPreflightLines(preflight);
        if (lines.length > 0) {
          inject.push(...lines);
          if (!updatedState.permissionPreflightNotified) {
            updatedState.permissionPreflightNotified = true;
          }
        }
        try { persistTaskState(taskId, updatedState, wamRoot); } catch {}
      }
    }
    try { recordTurn({ sessionID: input.sessionID, user: promptText }, wamRoot); } catch {}
    const budgetedAux = applyContextBudget(auxInject, {
      state: updatedState.phase || intentLane.lane,
    });
    if (typeof waitAMinute?.presentValidation === "function" && updatedState.phase !== "DONE") {
      const validation = await waitAMinute.presentValidation({
        analysis: {
          ...analysis,
          contractStatus: updatedState.contract.status,
          phase: updatedState.phase,
          completionContract: updatedState.contract,
        },
        ctx: null,
        meta: { sessionID: input.sessionID, messageID: output.message?.id || input.messageID },
        emit: false,
      });
      if (mergeValidationLines(inject, validation)) {
        inject.push(`fase ${updatedState.phase || "IMPLEMENTING"} → ${analysis.nextAction || updatedState.nextAction || "continuar"}`);
      }
    }

    const dedupedInject = filterNewContext([...contextInject, ...inject, ...budgetedAux], {
      root: wamRoot,
      sessionID: input.sessionID,
    });
    const wamBlockText = dedupedInject.length > 0 ? wrapWamBlock(dedupedInject.join("\n")) : "";

    if (wamBlockText) {
      emitTextPart(output, wamBlockText, { sessionID: input.sessionID, messageID: output.message?.id || input.messageID });
    }

    input.waitAnalysis = analysis;
  } catch (err) {
    console.error("[wait-a-minute] Pre-flight analysis failed:", err);
  }
}

/**
 * Extracts the prompt text from a chat.message input/output pair.
 * Extracted as a utility so it can be tested independently.
 *
 * @param {Object} input  - chat.message input
 * @param {Object} output - chat.message output
 * @returns {string}
 */
export function extractPrompt(input, output) {
  // SDK 1.19: chat.message output carries the user message parts; input is
  // minimal. We must read non-synthetic text parts from output.parts FIRST
  // (this is where the user's text now lives), but only when the part is
  // NOT a synthetic WAM injection — otherwise we re-consume our own output
  // and create a re-entrancy loop.
  //
  // Order of preference:
  //   1) output.parts — SDK 1.19 canonical location
  //   2) input.message.parts — pre-1.19 / tests / direct callers
  //   3) input.parts — legacy
  //   4) input.text — last-resort scalar fallback
  if (Array.isArray(output?.parts) && output.parts.length > 0) {
    const textPart = output.parts.find(
      (p) => p && p.type === "text" && typeof p.text === "string" && !isWamSynthetic(p),
    );
    if (textPart?.text) return textPart.text;
  }
  const srcParts = input?.message?.parts || input?.parts || [];
  if (srcParts.length > 0) {
    const textPart = srcParts.find(
      (p) => p.type === "text" && typeof p.text === "string" && !isWamSynthetic(p),
    );
    if (textPart?.text) return textPart.text;
  }
  if (input?.text && typeof input.text === "string") return input.text;
  return "";
}
