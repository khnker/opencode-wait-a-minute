/**
 * Tests for runtime/message-handler.js — modular chat.message processor.
 *
 * Regression test for Change 02: verify that the extracted handler
 * works correctly when called directly with explicit deps.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handleMessage, extractPrompt } from "../src/integration/message-handler.js";
import { tagWamPart } from "../src/integration/part-provenance.js";
import { initMemory } from "../src/persistence/memory.js";
import { getTaskState, persistTaskState } from "../src/skills/engine.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "wam-handler-"));
initMemory(ROOT);

/**
 * Minimal waitAMinute stub with the methods handleMessage invokes.
 */
const waitAMinute = {
  analyze: async ({ prompt }) => ({
    intent: { classification: "task", confidence: 90 },
    strategy: "NORMAL",
    ambiguity: "low",
    project: { detected_stack: "node", architecture: "unknown", known: [], inferred: [], assumed: [], unknown: [] },
    known: [],
    inferred: [],
    assumed: [],
    unknown: [],
    skills: { candidates: [], selected: [] },
    persistentPolicies: [],
    skillRegistry: {},
    completionContract: {
      rigor: "NORMAL",
      requirements: ["implementa X", "agrega tests"],
      verification: [],
      constraints: [],
      unknowns: [],
      assumptions: [],
    },
    _summary: "stub",
  }),
  buildPersistedState: (taskId, analysis, _root) => ({
    contract: analysis.completionContract,
    requirements: analysis.completionContract.requirements.map((title, i) => ({
      id: `req-${i + 1}`,
      title,
      status: "pending",
      evidence: [],
    })),
    phase: "PROPOSED",
    lastAction: "",
  }),
  evaluateCompletionGate: () => ({ blocked: false, allDone: false }),
  isCompletionIntent: (p) => /^(done|listo)\b|done\s+(the|my|this|that|task|tarea|it|all|everything)\b/i.test(String(p || "")),
  applyPhaseTransition: () => ({ phase: "PROPOSED", nextAction: "Implementar" }),
  approveContract: () => ({ ok: true }),
  presentValidation: () => ({}),
  addToBacklog: () => {},
  loadBundledRegistry: () => ({}),
};

const noop = () => undefined;
const baseDeps = () => ({
  bypassed: false,
  sessionTasks: new Map(),
  sessionStore: new Map(),
  cfg: { tierCaps: { fast: 8, medium: 5, heavy: 3 }, activePreset: "omni", contextBudget: 4000 },
  resolveSessionBase: async () => ROOT,
  wamRootFor: async () => ROOT,
  ensureWamMemory: async () => ROOT,
  effectiveTaskId: (_input, _st, root) => ({ taskId: `t-${Date.now()}`, fallbackKind: "explicit" }),
  isContinuationPrompt: () => false,
  genPartId: () => `prt_${Math.random().toString(16).slice(2, 18)}`,
  emitTextPart: (output, text, meta = {}) => {
    if (!output) return;
    const part = { id: `prt_${Math.random().toString(16).slice(2, 18)}`, type: "text", text, synthetic: true, ...meta };
    if (Array.isArray(output.parts)) output.parts.unshift(part);
    else if (Array.isArray(output.system)) output.system.unshift(part);
  },
  readActiveTaskIdFresh: () => null,
  writeActiveTaskId: noop,
  waitAMinute,
  getTaskState,
  persistTaskState,
  findDuplicateTask: () => null,
  escalateAssumptions: () => ({ changed: false }),
  buildAssumptions: (arr) => arr.map((x, i) => ({ id: `a-${i}`, statement: x, classification: "ASSUMPTION", status: "open" })),
  initMemory,
  updateProjectMemo: noop,
  updateLiveContext: noop,
  readLiveContext: () => "",
  persistLiveContext: noop,
  assembleContext: () => ({ lines: [], budget_used: 0, budget: 4000, levels: {} }),
  selectContextWithCqe: async () => ({}),
  detectFileSearchIntent: () => false,
  createSnapshot: noop,
  checkContinuation: () => ({ status: "VALID" }),
  rebuildScope: () => ({ rebuildN1: false, rebuildN3: false }),
  getDecision: () => null,
  recordDecision: noop,
  compactDecisions: noop,
  writeCavemanSummary: noop,
  truncate: (s, n) => String(s).slice(0, n),
  delegationLines: () => [],
  updateTaskMemory: noop,
  addRecentChange: noop,
  closeSession: noop,
  getSessionId: () => "test-session",
  classifyAskingMessage: (text) => {
    if (/(implementa|implementar)/i.test(text)) return "blocked-message";
    return "answer";
  },
});

// ---------------------------------------------------------------------------
// extractPrompt — utility
// ---------------------------------------------------------------------------

test("extractPrompt: lee prompt desde input.message.parts (formato 1.18.25)", () => {
  const input = { message: { parts: [{ type: "text", text: "hola mundo" }] } };
  const output = { parts: [] };
  assert.equal(extractPrompt(input, output), "hola mundo");
});

test("extractPrompt: ignora parts sintéticas de output y prefiere texto de usuario en output.parts (1.19)", () => {
  const input = { message: { parts: [{ type: "text", text: "viejo" }] } };
  const output = { parts: [{ type: "text", text: "nuevo" }] };
  assert.equal(extractPrompt(input, output), "nuevo");
});

test("extractPrompt: parte sintética WAM en output.parts no se autoconsume", () => {
  const input = { message: { parts: [{ type: "text", text: "viejo" }] } };
  const output = { parts: [tagWamPart({ type: "text", text: "[wam] inyección" }, { messageID: "m1" })] };
  assert.equal(extractPrompt(input, output), "viejo");
});

test("extractPrompt: fallback a input.parts (API legacy)", () => {
  const input = { parts: [{ type: "text", text: "legacy" }] };
  const output = {};
  assert.equal(extractPrompt(input, output), "legacy");
});

test("extractPrompt: retorna string vacío si no hay parts", () => {
  assert.equal(extractPrompt({}, {}), "");
});

// ---------------------------------------------------------------------------
// handleMessage — main behavior
// ---------------------------------------------------------------------------

test("handleMessage: prompt vacío → no-op (no inyecta parts)", async () => {
  const out = { message: {}, parts: [] };
  await handleMessage({ sessionID: "s1" }, out, baseDeps());
  assert.equal(out.parts.length, 0);
});

test("handleMessage: gate.allDone → confirmCompletion token-savings summary inyectada en output", async () => {
  const metricsDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-metrics-"));
  const prevMetricsDir = process.env.WAM_METRICS_DIR;
  process.env.WAM_METRICS_DIR = metricsDir;
  fs.writeFileSync(
    path.join(metricsDir, "token-savings.json"),
    JSON.stringify([{ taskId: "t-done", claimable: true, usageSource: "provider", savingsPct: 42, savingsTokens: 1234 }]),
    "utf-8",
  );

  const deps = baseDeps();
  deps.waitAMinute.evaluateCompletionGate = () => ({ blocked: false, allDone: true });
  deps.waitAMinute.applyPhaseTransition = () => ({ phase: "DONE", nextAction: "Listo" });
  deps.waitAMinute.buildPersistedState = (_taskId, analysis, _root) => {
    const requirements = analysis.completionContract.requirements.map((title, i) => ({
      id: `req-${i + 1}`,
      title,
      status: "VERIFIED",
    }));
    return {
      contract: analysis.completionContract,
      requirements,
      evidence: requirements.map((r) => ({
        requirementId: r.id,
        type: "test",
        strength: "L3_DIRECT",
        supports: true,
      })),
      phase: "DONE",
      lastAction: "",
    };
  };

  try {
    const out = { message: {}, parts: [] };
    await handleMessage(
      {
        sessionID: "s-done",
        messageID: "m-done",
        message: { parts: [{ type: "text", text: "implementa X" }] },
      },
      out,
      deps,
    );

    const injected = out.parts.map((p) => p.text).join("\n");
    assert.match(injected, /\[WAM Token Savings\] Task t-done saved 42% tokens: 1234 tokens saved vs measured baseline \(provider usage\)/);
  } finally {
    if (prevMetricsDir === undefined) delete process.env.WAM_METRICS_DIR;
    else process.env.WAM_METRICS_DIR = prevMetricsDir;
  }
});

test("handleMessage: cqe file_context → actualiza cqeCalls y persiste estado", async () => {
  const deps = baseDeps();
  deps.selectContextWithCqe = async () => ({
    file_context: [{ path: "src/x.js", snippet: "const x = 1;" }],
    cqeMeta: { elapsedMs: 1, source: "cqe" },
  });
  deps.detectFileSearchIntent = () => true;
  deps.waitAMinute.evaluateCompletionGate = () => ({ blocked: false, allDone: false });

  const out = { message: {}, parts: [] };
  await handleMessage(
    {
      sessionID: "s-cqe",
      messageID: "m-cqe",
      message: { parts: [{ type: "text", text: "search for parseConfig definitions" }] },
    },
    out,
    deps,
  );

  const state = getTaskState(deps.sessionTasks.get("s-cqe") || "t-cqe", ROOT);
  assert.equal(state.cqeCalls, 1);
});

test("handleMessage: cqe sin resultados → también cuenta la llamada", async () => {
  const deps = baseDeps();
  deps.selectContextWithCqe = async () => ({
    file_context: [],
    cqeMeta: { elapsedMs: 1, source: null, fallbackUsed: true, fallbackReason: "sin resultados" },
  });
  deps.detectFileSearchIntent = () => true;
  deps.waitAMinute.evaluateCompletionGate = () => ({ blocked: false, allDone: false });

  const out = { message: {}, parts: [] };
  await handleMessage(
    {
      sessionID: "s-cqe-empty",
      messageID: "m-cqe-empty",
      message: { parts: [{ type: "text", text: "search for parseConfig definitions" }] },
    },
    out,
    deps,
  );

  const state = getTaskState(deps.sessionTasks.get("s-cqe-empty") || "t-cqe-empty", ROOT);
  assert.equal(state.cqeCalls, 1);
  assert.ok(out.parts.some((p) => String(p.text || "").includes("sin resultados")));
});

test("handleMessage: disableCqe → no incrementa cqeCalls", async () => {
  const deps = baseDeps();
  deps.cfg.disableCqe = true;
  deps.selectContextWithCqe = async () => ({ file_context: [] });
  deps.detectFileSearchIntent = () => true;
  deps.waitAMinute.evaluateCompletionGate = () => ({ blocked: false, allDone: false });

  const out = { message: {}, parts: [] };
  await handleMessage(
    {
      sessionID: "s-cqe-off",
      messageID: "m-cqe-off",
      message: { parts: [{ type: "text", text: "search for parseConfig definitions" }] },
    },
    out,
    deps,
  );

  const state = getTaskState(deps.sessionTasks.get("s-cqe-off") || "t-cqe-off", ROOT);
  assert.equal(state?.cqeCalls || 0, 0);
});

test("handleMessage: bypassed=true → no-op", async () => {
  const deps = baseDeps();
  deps.bypassed = true;
  const out = { message: {}, parts: [] };
  await handleMessage(
    { sessionID: "s1", message: { parts: [{ type: "text", text: "refactor" }] } },
    out,
    deps,
  );
  assert.equal(out.parts.length, 0);
});

test("handleMessage: prompt con prompt simple invoca handleMessage sin lanzar", async () => {
  const out = { message: {}, parts: [] };
  // Verify the handler processes a normal prompt end-to-end with stub deps
  // without throwing. Detailed presentValidation behavior is covered by
  // existing plugin-load.test.mjs integration tests.
  await assert.doesNotReject(() =>
    handleMessage(
      {
        sessionID: "s1",
        messageID: "m1",
        message: { parts: [{ type: "text", text: "implementa X" }] },
      },
      out,
      baseDeps(),
    ),
  );
});

test("handleMessage: errors en deps se loggean sin propagar", async () => {
  const deps = baseDeps();
  deps.analyze = async () => { throw new Error("boom"); };
  // Must not throw — error is caught and logged.
  await assert.doesNotReject(() =>
    handleMessage(
      { sessionID: "s1", message: { parts: [{ type: "text", text: "x" }] } },
      { message: {}, parts: [] },
      deps,
    ),
  );
});

test.after(() => {
  try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch {}
});

// ---------------------------------------------------------------------------
// WAM injection block: delimiters, ordering and single prefix
// ---------------------------------------------------------------------------

test("handleMessage emits a delimited, ordered [wam][start]/[wam][end] block first", async () => {
  const deps = baseDeps();
  const emissions = [];
  const baseEmit = deps.emitTextPart;
  deps.emitTextPart = (output, text, meta = {}) => {
    emissions.push(text);
    baseEmit(output, text, meta);
  };
  deps.assembleContext = () => ({
    lines: ["[wam N0 policy] respetar AGENTS.md", "[wam skills] usar node-test"],
    budget_used: 20,
    budget: 4000,
    levels: {},
  });
  deps.delegationLines = () => ["[wam delegation] req-1 pendiente → delegar en subagente"];
  deps.waitAMinute = {
    ...waitAMinute,
    analyze: async () => ({
      intent: { classification: "task", confidence: 90 },
      strategy: "NORMAL",
      ambiguity: "low",
      project: { detected_stack: "node", architecture: "unknown", known: [], inferred: [], assumed: [], unknown: [] },
      known: [],
      inferred: [],
      assumed: [],
      unknown: [],
      skills: { candidates: [], selected: [] },
      persistentPolicies: [],
      skillRegistry: {},
      completionContract: {
        status: "APPROVED",
        objective: "implementar bloque de inyección wam",
        rigor: "NORMAL",
        requirements: ["implementa X", "agrega tests"],
        verification: [],
        constraints: [],
        unknowns: [],
        assumptions: [],
      },
      _summary: "stub",
    }),
  };

  const out = { message: {}, parts: [] };
  const input = {
    sessionID: "s-wam-block",
    messageID: "m-wam-block",
    message: { parts: [{ type: "text", text: "implementa el bloque wam" }] },
  };

  await handleMessage(input, out, deps);

  assert.ok(emissions.length > 0, "handleMessage emitted at least one part");
  const block = emissions[emissions.length - 1];

  assert.ok(block.startsWith("[wam][start]"), `block must start with [wam][start]: ${block.slice(0, 60)}`);
  assert.ok(block.trimEnd().endsWith("[wam][end]"), `block must end with [wam][end]: ${block.slice(-60)}`);
  assert.equal(out.parts[0].text, block, "block is emitted last and prepended to index 0");

  const n0 = block.indexOf("[wam N0");
  const skills = block.indexOf("[wam skills]");
  const delegation = block.indexOf("[wam delegation]");
  assert.ok(n0 >= 0, "context pack line [wam N0 ...] is present");
  assert.ok(skills > n0, "skills follow the context pack");
  assert.ok(delegation > skills, "context/skills precede delegation directives");

  const lines = block.split("\n").filter((line) => line.trim());
  assert.equal(lines[lines.length - 1], "[wam][end]", "[wam][end] is the last non-empty line");
  assert.ok(!block.startsWith("[wam] [wam][start]"), "the block must not be double-prefixed");
});
