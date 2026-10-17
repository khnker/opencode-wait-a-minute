/**
 * Tests for automatic prompt-based task id derivation.
 *
 * Verifies slugifyTaskPrompt + effectiveTaskId produce descriptive
 * `task-<slug>` ids from the user's prompt instead of falling back to the
 * monolithic `ses-<sessionID>` / `default-task` namespaces.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import plugin from "../../index.js";
const { slugifyTaskPrompt, effectiveTaskId, isContinuationPrompt } = plugin;

// ---------------------------------------------------------------------------
// slugifyTaskPrompt
// ---------------------------------------------------------------------------
test("slugifyTaskPrompt: accents + spaces → kebab slug", () => {
  assert.strictEqual(
    slugifyTaskPrompt("Implementar módulo de autenticación OAuth2"),
    "implementar-modulo-de-autenticacion-oauth2",
  );
});

test("slugifyTaskPrompt: punctuation stripped, collapsed", () => {
  assert.strictEqual(
    slugifyTaskPrompt("Fix the bug in the login!!! flow..."),
    "fix-the-bug-in-the-login-flow",
  );
});

test("slugifyTaskPrompt: caps + mixed → lowercase", () => {
  assert.strictEqual(
    slugifyTaskPrompt("Add unit tests for the payment gateway"),
    "add-unit-tests-for-the-payment-gateway",
  );
});

test("slugifyTaskPrompt: length capped at 48", () => {
  const longText = "x".repeat(200);
  const slug = slugifyTaskPrompt(longText);
  assert.ok(slug, "should produce a slug for long text");
  assert.ok(slug.length <= 48, `slug too long: ${slug.length}`);
});

test("slugifyTaskPrompt: null for empty/short/generic", () => {
  assert.strictEqual(slugifyTaskPrompt(""), null);
  assert.strictEqual(slugifyTaskPrompt("   "), null);
  assert.strictEqual(slugifyTaskPrompt("hola"), null);
  assert.strictEqual(slugifyTaskPrompt("ok"), null);
  assert.strictEqual(slugifyTaskPrompt("fix"), null);
  assert.strictEqual(slugifyTaskPrompt("test"), null);
  assert.strictEqual(slugifyTaskPrompt(null), null);
  assert.strictEqual(slugifyTaskPrompt(undefined), null);
});

test("slugifyTaskPrompt: single command without args → null", () => {
  assert.strictEqual(slugifyTaskPrompt("/help"), null);
  assert.strictEqual(slugifyTaskPrompt("/wam"), null);
});

test("slugifyTaskPrompt: command with args → slug", () => {
  assert.strictEqual(slugifyTaskPrompt("/wam task switch auth"), "wam-task-switch-auth");
});

// ---------------------------------------------------------------------------
// effectiveTaskId — integration with slug fallback
// ---------------------------------------------------------------------------
function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-task-id-"));
}

test("effectiveTaskId: explicit taskId wins over prompt slug", () => {
  const root = makeRoot();
  const sessionTasks = new Map();
  const resolved = effectiveTaskId(
    { sessionID: "s1", taskId: "my-explicit-task" },
    sessionTasks,
    root,
    "implementar algo",
  );
  assert.deepStrictEqual(resolved, {
    taskId: "my-explicit-task",
    fallbackKind: "explicit",
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test("effectiveTaskId: cached session task wins", () => {
  const root = makeRoot();
  const sessionTasks = new Map([["s2", "cached-task"]]);
  const resolved = effectiveTaskId(
    { sessionID: "s2" },
    sessionTasks,
    root,
    "implementar algo",
  );
  assert.deepStrictEqual(resolved, {
    taskId: "cached-task",
    fallbackKind: "cached",
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test("effectiveTaskId: prompt slug used when no explicit/cached/active", () => {
  const root = makeRoot();
  const sessionTasks = new Map();
  const resolved = effectiveTaskId(
    { sessionID: "s3" },
    sessionTasks,
    root,
    "Implementar módulo de autenticación OAuth2",
  );
  assert.deepStrictEqual(resolved, {
    taskId: "task-implementar-modulo-de-autenticacion-oauth2-sess-s3",
    fallbackKind: "slug-session-bound",
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test("effectiveTaskId: generic prompt falls back to ses-<sessionID>", () => {
  const root = makeRoot();
  const sessionTasks = new Map();
  const resolved = effectiveTaskId(
    { sessionID: "abc123def" },
    sessionTasks,
    root,
    "hola",
  );
  assert.deepStrictEqual(resolved, {
    taskId: "ses-abc123def",
    fallbackKind: "session",
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test("effectiveTaskId: no session + generic prompt → default-task", () => {
  const root = makeRoot();
  const sessionTasks = new Map();
  const resolved = effectiveTaskId({}, sessionTasks, root, "hola");
  assert.deepStrictEqual(resolved, {
    taskId: "default-task",
    fallbackKind: "default",
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test("effectiveTaskId: continuation prompt does NOT derive new slug", () => {
  const root = makeRoot();
  const sessionTasks = new Map();
  const resolved = effectiveTaskId(
    { sessionID: "xyz" },
    sessionTasks,
    root,
    "ok",
  );
  assert.strictEqual(resolved.taskId, "ses-xyz");
  assert.strictEqual(resolved.fallbackKind, "session");
  fs.rmSync(root, { recursive: true, force: true });
});

test("effectiveTaskId: no session + descriptive prompt → task-<slug>", () => {
  const root = makeRoot();
  const sessionTasks = new Map();
  const resolved = effectiveTaskId({}, sessionTasks, root, "Fix the login bug");
  assert.strictEqual(resolved.taskId, "task-fix-the-login-bug-sess-nosess");
  assert.strictEqual(resolved.fallbackKind, "slug-session-bound-nosession");
  fs.rmSync(root, { recursive: true, force: true });
});

test("effectiveTaskId: generic taskId input ignored in favor of slug", () => {
  const root = makeRoot();
  const sessionTasks = new Map();
  const resolved = effectiveTaskId(
    { sessionID: "s4", taskId: "default-task" },
    sessionTasks,
    root,
    "Add payment gateway tests",
  );
  assert.strictEqual(resolved.taskId, "task-add-payment-gateway-tests-sess-s4");
  assert.strictEqual(resolved.fallbackKind, "slug-session-bound");
  fs.rmSync(root, { recursive: true, force: true });
});
// ---------------------------------------------------------------------------
// isContinuationPrompt — short / continuation / tool-exec prompts
// ---------------------------------------------------------------------------
test("isContinuationPrompt: empty/whitespace → true", () => {
  assert.strictEqual(isContinuationPrompt(""), true);
  assert.strictEqual(isContinuationPrompt("   "), true);
  assert.strictEqual(isContinuationPrompt(null), true);
  assert.strictEqual(isContinuationPrompt(undefined), true);
});
test("isContinuationPrompt: very short (<4 chars) → true", () => {
  assert.strictEqual(isContinuationPrompt("ok"), true);
  assert.strictEqual(isContinuationPrompt("ya"), true);
  assert.strictEqual(isContinuationPrompt("go"), true);
});
test("isContinuationPrompt: continuation words → true", () => {
  assert.strictEqual(isContinuationPrompt("sigue"), true);
  assert.strictEqual(isContinuationPrompt("continua"), true);
  assert.strictEqual(isContinuationPrompt("continuemos"), true);
  assert.strictEqual(isContinuationPrompt("siguiente"), true);
  assert.strictEqual(isContinuationPrompt("retoma"), true);
  assert.strictEqual(isContinuationPrompt("seguir"), true);
  assert.strictEqual(isContinuationPrompt("continue"), true);
  assert.strictEqual(isContinuationPrompt("proceed"), true);
  assert.strictEqual(isContinuationPrompt("next"), true);
  assert.strictEqual(isContinuationPrompt("listo"), true);
  assert.strictEqual(isContinuationPrompt("dale"), true);
  assert.strictEqual(isContinuationPrompt("done"), true);
});
test("isContinuationPrompt: tool execution messages → true", () => {
  assert.strictEqual(isContinuationPrompt("bash ls -la"), true);
  assert.strictEqual(isContinuationPrompt("read file.js"), true);
  assert.strictEqual(isContinuationPrompt("node script.js"), true);
  assert.strictEqual(isContinuationPrompt("[tool] executed"), true);
  assert.strictEqual(isContinuationPrompt("tool execute"), true);
});
test("isContinuationPrompt: substantive prompt → false", () => {
  assert.strictEqual(isContinuationPrompt("Implementar módulo de autenticación OAuth2"), false);
  assert.strictEqual(isContinuationPrompt("Fix the bug in the login flow"), false);
  assert.strictEqual(isContinuationPrompt("agregar unit tests"), false);
});
// ---------------------------------------------------------------------------
// effectiveTaskId — continuation prompts must NOT spawn new task-<slug>
// ---------------------------------------------------------------------------
test("effectiveTaskId: continuation prompt reuses cached session task", () => {
  const root = makeRoot();
  const sessionTasks = new Map([["s4", "cached-task"]]);
  const resolved = effectiveTaskId({ sessionID: "s4" }, sessionTasks, root, "sigue");
  assert.strictEqual(resolved.taskId, "cached-task");
  assert.strictEqual(resolved.fallbackKind, "cached");
  fs.rmSync(root, { recursive: true, force: true });
});
test("effectiveTaskId: continuation prompt reuses fresh active task", () => {
  const root = makeRoot();
  // write active-task record fresh (<60s)
  const { writeActiveTaskId } = plugin;
  writeActiveTaskId("active-task-x", root);
  const sessionTasks = new Map();
  const resolved = effectiveTaskId({ sessionID: "s5" }, sessionTasks, root, "continua");
  assert.strictEqual(resolved.taskId, "active-task-x");
  assert.strictEqual(resolved.fallbackKind, "active");
  fs.rmSync(root, { recursive: true, force: true });
});
test("effectiveTaskId: continuation prompt falls back to ses-<sessionID>", () => {
  const root = makeRoot();
  const sessionTasks = new Map();
  const resolved = effectiveTaskId({ sessionID: "abc123def" }, sessionTasks, root, "sigue");
  assert.strictEqual(resolved.taskId, "ses-abc123def");
  assert.strictEqual(resolved.fallbackKind, "session");
  fs.rmSync(root, { recursive: true, force: true });
});
test("effectiveTaskId: tool execution message reuses cached session task", () => {
  const root = makeRoot();
  const sessionTasks = new Map([["s6", "cached-tool-task"]]);
  const resolved = effectiveTaskId({ sessionID: "s6" }, sessionTasks, root, "bash ls -la");
  assert.strictEqual(resolved.taskId, "cached-tool-task");
  assert.strictEqual(resolved.fallbackKind, "cached");
  fs.rmSync(root, { recursive: true, force: true });
});

test("session binding sobrevive restarts: active-task propio sin TTL", () => {
  const root = makeRoot();
  const { writeActiveTaskId } = plugin;
  // Simula binding escrito hace días por la misma sesión
  writeActiveTaskId("task-mi-tarea-sess-s9", root, { sessionId: "s9", projectRoot: root });
  const recPath = path.join(root, ".wam", "active-task");
  const rec = JSON.parse(fs.readFileSync(recPath, "utf-8"));
  rec.ts = Date.now() - 3 * 24 * 3600 * 1000; // 3 días atrás
  fs.writeFileSync(recPath, JSON.stringify(rec));
  // Mapa de sesión vacío = proceso recién reiniciado
  const resolved = effectiveTaskId({ sessionID: "s9" }, new Map(), root, "Implementar otra cosa nueva");
  assert.strictEqual(resolved.taskId, "task-mi-tarea-sess-s9");
  assert.strictEqual(resolved.fallbackKind, "active");
  fs.rmSync(root, { recursive: true, force: true });
});

test("session binding: otra sesión NO adopta el active-task ajeno", () => {
  const root = makeRoot();
  const { writeActiveTaskId } = plugin;
  writeActiveTaskId("task-ajena-sess-s9", root, { sessionId: "s9", projectRoot: root });
  const resolved = effectiveTaskId({ sessionID: "sX" }, new Map(), root, "Implementar algo distinto");
  assert.notStrictEqual(resolved.taskId, "task-ajena-sess-s9");
  fs.rmSync(root, { recursive: true, force: true });
});
