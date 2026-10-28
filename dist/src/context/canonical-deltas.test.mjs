import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  acceptDelta,
  basePath,
  listDeltas,
  loadBase,
  materializeBase,
  proposalsPath,
  proposeDelta,
  rejectDelta,
  validateDelta,
} from "./canonical-deltas.js";

const MEMO = [
  "# Project Context",
  "## Facts",
  "- OpenSpec es la fuente de verdad de los cambios",
  "## Stack (observed)",
  "- Node 20",
  "## Inferred",
  "- El usuario escribe en español",
].join("\n");

function makeRoot(t, memo = MEMO) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-canonical-deltas-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (memo != null) {
    fs.mkdirSync(path.join(root, ".wam", "context"), { recursive: true });
    fs.writeFileSync(path.join(root, ".wam", "context", "project.md"), memo);
  }
  return root;
}

function factOps(text) {
  return [{ op: "add", entry: { kind: "fact", text, section: "facts", source: "test" } }];
}

test("loadBase seeds version 0 from the CPC when base.json is absent", async (t) => {
  const root = makeRoot(t);
  const base = await loadBase(root);
  assert.equal(base.version, 0);
  assert.equal(base.previousVersion, null);
  assert.equal(base.entries.length, 3);
  assert.deepEqual(base.entries.map((e) => e.kind), ["fact", "fact", "assumption"]);
  assert.ok(fs.existsSync(basePath(root)));
});

test("propose does not mutate the base snapshot", async (t) => {
  const root = makeRoot(t);
  const before = await loadBase(root);
  const proposal = await proposeDelta(root, factOps("Nueva decisión"), { reason: "test" });
  const after = await loadBase(root);
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.baseVersion, 0);
  assert.equal(after.version, 0);
  assert.deepEqual(after.entries, before.entries);
});

test("reject leaves the base untouched and marks the proposal rejected", async (t) => {
  const root = makeRoot(t);
  const before = await loadBase(root);
  const proposal = await proposeDelta(root, factOps("Rechazada"));
  const result = await rejectDelta(root, proposal.id, { decision: "no" });
  assert.equal(result.ok, true);
  assert.equal(result.proposal.status, "rejected");
  assert.deepEqual(await loadBase(root), before);
});

test("accept bumps version and keeps previousVersion", async (t) => {
  const root = makeRoot(t);
  const proposal = await proposeDelta(root, factOps("Hecho aceptado"));
  const result = await acceptDelta(root, proposal.id, { decision: "ok" });
  assert.equal(result.ok, true);
  assert.equal(result.base.version, 1);
  assert.equal(result.base.previousVersion, 0);
  assert.ok(result.base.entries.some((e) => e.text === "Hecho aceptado"));
  assert.equal(result.proposal.status, "accepted");
});

test("update/invalidate on missing or already-invalidated entries fails without writes", async (t) => {
  const root = makeRoot(t);
  const base = await loadBase(root);
  const missing = base.entries[0].id + "-nope";
  const update = await proposeDelta(root, [
    { op: "update", entryId: missing, entry: { kind: "fact", text: "x" } },
  ]);
  const updateCheck = await validateDelta(root, update.id);
  assert.equal(updateCheck.ok, false);
  assert.match(updateCheck.errors.join("; "), /not found/);

  const invalidate = await proposeDelta(root, [{ op: "invalidate", entryId: base.entries[0].id }]);
  assert.equal((await acceptDelta(root, invalidate.id)).ok, true);
  const again = await proposeDelta(root, [{ op: "invalidate", entryId: base.entries[0].id }]);
  const againCheck = await validateDelta(root, again.id);
  assert.equal(againCheck.ok, false);
  assert.match(againCheck.errors.join("; "), /not active/);

  assert.equal((await loadBase(root)).version, 1);
  assert.equal((await listDeltas(root)).find((p) => p.id === update.id).status, "proposed");
});

test("baseVersion mismatch fails validation and accept", async (t) => {
  const root = makeRoot(t);
  const first = await proposeDelta(root, factOps("Primero"));
  const stale = await proposeDelta(root, factOps("Obsoleto"));
  assert.equal((await acceptDelta(root, first.id)).ok, true);

  const check = await validateDelta(root, stale.id);
  assert.equal(check.ok, false);
  assert.match(check.errors.join("; "), /baseVersion mismatch/);
  const result = await acceptDelta(root, stale.id);
  assert.equal(result.ok, false);
  assert.equal((await loadBase(root)).version, 1);
});

test("invalid op, kind and duplicated ids are rejected", async (t) => {
  const root = makeRoot(t);
  const badOp = await proposeDelta(root, [{ op: "delete", entryId: "x" }]);
  assert.match((await validateDelta(root, badOp.id)).errors.join("; "), /op must be one of/);

  const badKind = await proposeDelta(root, [
    { op: "add", entry: { kind: "rumor", text: "sin base", section: "facts", source: "test" } },
  ]);
  assert.match((await validateDelta(root, badKind.id)).errors.join("; "), /kind must be one of/);

  const base = await loadBase(root);
  const dup = await proposeDelta(root, [
    { op: "add", entry: { id: base.entries[0].id, kind: "fact", text: "dup", section: "facts" } },
  ]);
  assert.match((await validateDelta(root, dup.id)).errors.join("; "), /already exists/);
  assert.equal((await loadBase(root)).version, 0);
});

test("session-contaminated entries are rejected by the CPC validator", async (t) => {
  const root = makeRoot(t);
  const proposal = await proposeDelta(root, factOps("task state: implementing"));
  const check = await validateDelta(root, proposal.id);
  assert.equal(check.ok, false);
  assert.match(check.errors.join("; "), /session data contamination/);
  assert.equal((await loadBase(root)).version, 0);
});

test("persisted state reloads across new calls", async (t) => {
  const root = makeRoot(t);
  const proposal = await proposeDelta(root, factOps("Persistido"));
  await acceptDelta(root, proposal.id);

  const reloadedBase = await loadBase(root);
  const reloadedDeltas = await listDeltas(root);
  assert.equal(reloadedBase.version, 1);
  assert.equal(reloadedBase.entries.at(-1).text, "Persistido");
  assert.equal(reloadedDeltas.find((p) => p.id === proposal.id).status, "accepted");
  assert.ok(fs.existsSync(proposalsPath(root)));
});

test("invalidated facts leave materialized output but stay in base history", async (t) => {
  const root = makeRoot(t);
  const base = await loadBase(root);
  const target = base.entries.find((e) => e.text.includes("OpenSpec"));
  const proposal = await proposeDelta(root, [{ op: "invalidate", entryId: target.id }]);
  assert.equal((await acceptDelta(root, proposal.id)).ok, true);

  const text = await materializeBase(root);
  assert.equal(text.includes("OpenSpec es la fuente de verdad"), false);
  assert.equal(text.includes("Node 20"), true);

  const invalidated = (await loadBase(root)).entries.find((e) => e.id === target.id);
  assert.equal(invalidated.status, "invalidated");
  assert.equal(invalidated.invalidatedBy, proposal.id);
  assert.ok(invalidated.invalidatedAt);
});

test("accepting an already accepted proposal fails safely", async (t) => {
  const root = makeRoot(t);
  const proposal = await proposeDelta(root, factOps("Una sola vez"));
  assert.equal((await acceptDelta(root, proposal.id)).ok, true);
  const again = await acceptDelta(root, proposal.id);
  assert.equal(again.ok, false);
  assert.match(again.errors.join("; "), /already accepted/);
  assert.equal((await loadBase(root)).version, 1);
});

test("materializeBase never writes the CPC memo", async (t) => {
  const root = makeRoot(t);
  const memoPath = path.join(root, ".wam", "context", "project.md");
  const before = fs.readFileSync(memoPath, "utf8");
  const proposal = await proposeDelta(root, factOps("Solo en base"));
  await acceptDelta(root, proposal.id);
  await materializeBase(root);
  assert.equal(fs.readFileSync(memoPath, "utf8"), before);
});
