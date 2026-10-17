import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  setLoggingEnabled,
  setDebugEnabled,
  isDebugEnabled,
  isLoggingEnabled,
  registerLogicGate,
  getLogicGates,
  resetLogicGates,
  wamLog,
  wamWarn,
  wamError,
  wamDebug,
  wamAuditModuleLoad,
  wamStartTimer,
  getBenchmarkStats,
  resetBenchmarkStats,
} from "../../src/shared/wam-log.js";

const ENV_KEYS = ["WAM_DEBUG", "WAM_LOG_LEVEL"];
let saved = {};
beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  setLoggingEnabled(true);
  setDebugEnabled(false);
  resetLogicGates();
  resetBenchmarkStats();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function captureConsole(fn) {
  const seen = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a) => seen.push({ level: "log", args: a });
  console.warn = (...a) => seen.push({ level: "warn", args: a });
  console.error = (...a) => seen.push({ level: "error", args: a });
  try { fn(); } finally { Object.assign(console, orig); }
  return seen;
}

test("wamLog/wamWarn/wamError respect loggingEnabled", () => {
  setLoggingEnabled(false);
  const seen = captureConsole(() => {
    wamLog("hidden-log");
    wamWarn("hidden-warn");
    wamError("hidden-error");
  });
  assert.equal(seen.length, 0);

  setLoggingEnabled(true);
  const seen2 = captureConsole(() => {
    wamLog("shown-log");
    wamWarn("shown-warn");
    wamError("shown-error");
  });
  assert.equal(seen2.length, 3);
  assert.equal(seen2[0].level, "log");
  assert.equal(seen2[1].level, "warn");
  assert.equal(seen2[2].level, "error");
});

test("wamDebug is gated by both logging and debug flags", () => {
  setDebugEnabled(true);
  setLoggingEnabled(false);
  const seen = captureConsole(() => wamDebug("cat", "msg", { a: 1 }));
  assert.equal(seen.length, 0);

  setDebugEnabled(false);
  setLoggingEnabled(true);
  const seen2 = captureConsole(() => wamDebug("cat", "msg", { a: 1 }));
  assert.equal(seen2.length, 0);

  setDebugEnabled(true);
  setLoggingEnabled(true);
  const seen3 = captureConsole(() => wamDebug("cat", "msg", { a: 1 }));
  assert.equal(seen3.length, 1);
  assert.match(seen3[0].args[0], /\[WAM-DEBUG .*\] \[cat\] msg/);
  assert.deepEqual(seen3[0].args[1], { a: 1 });
});

test("registerLogicGate records and emits a trace when debug is on", () => {
  setDebugEnabled(true);
  const seen = captureConsole(() => registerLogicGate("skills", { loaded: true, source: "wam-config", note: "skill routing" }));
  const gates = getLogicGates();
  assert.equal(gates.length, 1);
  assert.deepEqual(gates[0], {
    name: "skills",
    loaded: true,
    source: "wam-config",
    note: "skill routing",
    timestamp: gates[0].timestamp,
  });
  assert.match(seen[0].args[0], /\[WAM-LOGIC-GATE\] 'skills' -> loaded=true source='wam-config'/);
});

test("registerLogicGate is silent when debug is off", () => {
  setDebugEnabled(false);
  const seen = captureConsole(() => registerLogicGate("enforcement", { loaded: false, source: "env", note: "bypass" }));
  assert.equal(seen.length, 0);
  const gates = getLogicStats();
  assert.equal(gates.length, 1);
  assert.equal(gates[0].loaded, false);
});

function getLogicStats() {
  return getLogicGates();
}

test("resetLogicGates clears the registry", () => {
  registerLogicGate("a", { loaded: true });
  registerLogicGate("b", { loaded: false });
  assert.equal(getLogicGates().length, 2);
  resetLogicGates();
  assert.equal(getLogicGates().length, 0);
});

test("wamAuditModuleLoad records and traces", () => {
  setDebugEnabled(true);
  const seen = captureConsole(() => wamAuditModuleLoad("engine.js", "ok", { ms: 5 }));
  assert.equal(getBenchmarkStats().moduleLoads.length, 1);
  assert.match(seen[0].args[0], /\[WAM-MODULE-AUDIT\] Module 'engine.js' -> STATUS: ok/);
});

test("wamStartTimer records latency samples", () => {
  const timer = wamStartTimer("op", { kind: "risk" });
  const ms = timer.end({ extra: 1 });
  assert.ok(typeof ms === "number");
  assert.equal(getBenchmarkStats().latencies.length, 1);
  assert.equal(getBenchmarkStats().latencies[0].label, "op");
  assert.equal(getBenchmarkStats().latencies[0].metadata.kind, "risk");
  assert.equal(getBenchmarkStats().latencies[0].metadata.extra, 1);
});

test("wamStartTimer traces when debug on", () => {
  setDebugEnabled(true);
  const seen = captureConsole(() => {
    const t = wamStartTimer("bench");
    t.end();
  });
  assert.match(seen[0].args[0], /\[WAM-BENCHMARK\] 'bench' took .*ms/);
});

test("getBenchmarkStats / resetBenchmarkStats round-trip", () => {
  wamAuditModuleLoad("a", "ok");
  const t = wamStartTimer("x");
  t.end();
  const stats = getBenchmarkStats();
  assert.equal(stats.moduleLoads.length, 1);
  assert.equal(stats.latencies.length, 1);
  resetBenchmarkStats();
  assert.deepEqual(getBenchmarkStats(), { moduleLoads: [], latencies: [] });
});

test("isDebugEnabled reflects setDebugEnabled", () => {
  assert.equal(isDebugEnabled(), false);
  setDebugEnabled(true);
  assert.equal(isDebugEnabled(), true);
});

test("WAM_DEBUG env turns debug on at module load", async () => {
  process.env.WAM_DEBUG = "1";
  // Re-evaluate the module-level debugEnabled flag by re-importing.
  const mod = await import("../../src/shared/wam-log.js?t=" + Date.now());
  assert.equal(mod.isDebugEnabled(), true);
});