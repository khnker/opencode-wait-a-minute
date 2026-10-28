/**
 * Session identity — one WAM session per OpenCode session.
 *
 * Regression guard: WAM used to bind every OpenCode session of a project to a
 * single shared session file (the "default" one) because the runtime never
 * forwarded the OpenCode `sessionID` into the session identity mechanism.
 * Result: sessions shared capsules and session state.
 *
 * Contract:
 *  - same OpenCode sessionID  → same WAM session id + same session file
 *  - different sessionIDs     → different ids + different files (isolated)
 *  - no sessionID             → stable legacy default identity for that root
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

delete process.env.WAM_SESSION_DIR;

import {
  createCapsule,
  getSessionId,
  listCapsules,
  resetSessionCache,
  sessionIdFromOpenCode,
  setActiveSession,
} from "../src/context/context.js";

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-session-"));
}

function sessionFiles(root) {
  try {
    return fs
      .readdirSync(path.join(root, ".wam"))
      .filter((f) => f.startsWith("session_") && f.endsWith(".json"));
  } catch {
    return [];
  }
}

test("distinct OpenCode sessions get distinct identities and distinct files", () => {
  const root = tmpRoot();
  resetSessionCache();

  const a = getSessionId(root, "ses_alpha");
  const b = getSessionId(root, "ses_beta");

  assert.notEqual(a, b);
  assert.equal(a, "ses_alpha");
  assert.equal(b, "ses_beta");
  assert.equal(sessionFiles(root).length, 2);
});

test("the same OpenCode session keeps its identity across cache resets (new process)", () => {
  const root = tmpRoot();
  resetSessionCache();
  const first = getSessionId(root, "ses_alpha");

  resetSessionCache(); // simulates a plugin reload / new process
  const second = getSessionId(root, "ses_alpha");

  assert.equal(first, second);
  assert.equal(sessionFiles(root).length, 1);
});

test("sessions of different roots keep their own session files", () => {
  const rootA = tmpRoot();
  const rootB = tmpRoot();
  resetSessionCache();

  getSessionId(rootA, "ses_alpha");
  getSessionId(rootB, "ses_alpha");

  assert.equal(sessionFiles(rootA).length, 1);
  assert.equal(sessionFiles(rootB).length, 1);
  assert.notEqual(
    path.join(rootA, ".wam", "session_ses_alpha.json"),
    path.join(rootB, ".wam", "session_ses_alpha.json"),
  );
});

test("the active session pointer resolves the identity for call sites without sessionID", () => {
  const root = tmpRoot();
  resetSessionCache();

  setActiveSession(root, "ses_alpha");
  assert.equal(getSessionId(root), "ses_alpha");

  setActiveSession(root, "ses_beta");
  assert.equal(getSessionId(root), "ses_beta");
});

test("without a sessionID the identity falls back to a stable per-root default", () => {
  const root = tmpRoot();
  resetSessionCache();
  const first = getSessionId(root);

  resetSessionCache();
  const second = getSessionId(root);

  assert.equal(first, second);
  assert.ok(first.startsWith("ses_"));
});

test("unsafe session ids are hashed and never collide with the file path", () => {
  assert.equal(sessionIdFromOpenCode("ses_ok-1"), "ses_ok-1");
  assert.match(sessionIdFromOpenCode("ses/../evil id"), /^ses_[0-9a-f]{16}$/);
  assert.notEqual(sessionIdFromOpenCode("ses/../evil id"), sessionIdFromOpenCode("ses/../other id"));
  assert.equal(sessionIdFromOpenCode(""), "");
});

test("capsules of one session are invisible to another session", () => {
  const root = tmpRoot();
  resetSessionCache();
  const sidA = getSessionId(root, "ses_alpha");
  const sidB = getSessionId(root, "ses_beta");

  createCapsule(
    {
      context_id: "ctx_alpha",
      level: "L1",
      lifecycle: "active",
      content: "alpha only",
      provenance: "test",
    },
    root,
    "ses_alpha",
  );

  const forA = listCapsules(root, { sessionId: sidA });
  const forB = listCapsules(root, { sessionId: sidB });

  assert.equal(forA.length, 1);
  assert.equal(forB.length, 0);
  assert.equal(forA[0].session_id, sidA);
});
