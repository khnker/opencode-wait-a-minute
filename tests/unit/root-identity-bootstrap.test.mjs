/**
 * Root identity & bootstrap — regressions de F1/F2/F3.
 * Ejecutar: node --test --test-force-exit tests/unit/root-identity-bootstrap.test.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  setActiveSession,
  getSessionId,
  resetSessionCache,
  resolveWamRoot,
  clearRepoCache,
  isSessionId,
  isBootstrapRoot,
  applyBootstrapApproval,
} from "../../src/context/context.js";

// Estos tests verifican el puntero por root (`<root>/.wam/active_session.json`).
// El runner redirige WAM_SESSION_DIR a /tmp: se desactiva para medir el root real.
delete process.env.WAM_SESSION_DIR;

function tmpRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readActive(root) {
  return JSON.parse(fs.readFileSync(path.join(root, ".wam", "active_session.json"), "utf-8"));
}

function makeRepo(dir) {
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  return dir;
}

function writeTaskMemory(repo, taskId, text) {
  const dir = path.join(repo, ".wam", "tasks", taskId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "context.md"), text);
}

// -- F1: session identity ----------------------------------------------------

test("setActiveSession: una ruta nunca se persiste como opencode_session_id", (t) => {
  const root = tmpRoot("wam-identity-");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const sid = setActiveSession(root, "/abs/path/to/project");
  const state = readActive(root);

  assert.equal(state.opencode_session_id, null, "la ruta no se guarda como identidad");
  assert.match(sid, /^ses_/, "devuelve una identidad usable");
  assert.equal(state.session_id, sid);
  assert.ok(!String(state.opencode_session_id ?? "").includes("/"));
  assert.equal(getSessionId(root, "/abs/path/to/project"), sid, "la identidad derivada sigue resolviendo");
});

test("setActiveSession: un session id real sí se enlaza", (t) => {
  const root = tmpRoot("wam-identity-ok-");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  setActiveSession(root, "ses_abc123");
  assert.equal(readActive(root).opencode_session_id, "ses_abc123");
  assert.equal(isSessionId("ses_abc123", root), true);
  assert.equal(isSessionId(root, root), false);
});

test("getSessionId: estado legacy con una ruta en el puntero sigue funcionando", (t) => {
  const root = tmpRoot("wam-identity-legacy-");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(path.join(root, ".wam"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".wam", "active_session.json"),
    JSON.stringify({ session_id: "ses_legacy123", opencode_session_id: "/abs/path/to/project" }, null, 2),
  );
  resetSessionCache();

  assert.equal(getSessionId(root), "ses_legacy123");
});

// -- F2: root resolution -----------------------------------------------------

test("resolveWamRoot: el .wam propio gana sobre un repo hermano más reciente", (t) => {
  const proj = tmpRoot("wam-own-");
  t.after(() => fs.rmSync(proj, { recursive: true, force: true }));

  fs.mkdirSync(path.join(proj, ".wam", "context"), { recursive: true });
  const sibling = makeRepo(path.join(proj, "sibling"));
  writeTaskMemory(sibling, "t-fresh", "# Live Task Context\ntask: t-fresh");
  clearRepoCache();

  assert.equal(resolveWamRoot("", proj), proj);
});

test("resolveWamRoot: contenedor sin .wam sigue matcheando el repo nombrado", (t) => {
  const proj = tmpRoot("wam-named-");
  t.after(() => fs.rmSync(proj, { recursive: true, force: true }));

  const repo = makeRepo(path.join(proj, "frontend"));
  writeTaskMemory(repo, "t-1", "# Live Task Context\ntask: t-1");
  clearRepoCache();

  assert.equal(resolveWamRoot("arregla el bug del frontend", proj), repo);
});

// -- F3: bootstrap -----------------------------------------------------------

test("bootstrap: la primera tarea nace aprobada y la segunda sigue PROPOSED", (t) => {
  const root = tmpRoot("wam-bootstrap-");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.equal(isBootstrapRoot(root, "task-a"), true);
  const first = applyBootstrapApproval(
    { phase: "PROPOSED", contract: { status: "PROPOSED" }, requirements: [{ id: "req-1", status: "pending" }] },
    "task-a",
    root,
  );
  assert.equal(first.phase, "IMPLEMENTING");
  assert.equal(first.contract.status, "APPROVED");
  assert.equal(first.contract.approvedBy, "bootstrap");

  fs.mkdirSync(path.join(root, ".wam", "tasks", "task-a"), { recursive: true });
  assert.equal(isBootstrapRoot(root, "task-b"), false);
  const second = applyBootstrapApproval(
    { phase: "PROPOSED", contract: { status: "PROPOSED" } },
    "task-b",
    root,
  );
  assert.equal(second.phase, "PROPOSED");
  assert.equal(second.contract.status, "PROPOSED");
  assert.equal(second.contract.approvedBy, undefined);
});

test("bootstrap: un root con project.md ya no bootstrapea", (t) => {
  const root = tmpRoot("wam-bootstrap-off-");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(path.join(root, ".wam", "context"), { recursive: true });
  fs.writeFileSync(path.join(root, ".wam", "context", "project.md"), "# Project");
  assert.equal(isBootstrapRoot(root, "task-a"), false);
});
