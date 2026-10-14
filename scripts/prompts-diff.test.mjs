import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fixturePathForId, runDiff, EVAL_SKIP_NOTICE } from "./prompts-diff.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = path.join(REPO_ROOT, "scripts/prompts-diff.mjs");
const CATALOG = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "prompts/index.json"), "utf8")).prompts;

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: REPO_ROOT, encoding: "utf8" });
}

function withTempCandidate(body, fn) {
  const file = path.join(os.tmpdir(), `wam-diff-candidate-${process.pid}-${Math.random().toString(36).slice(2)}.md`);
  fs.writeFileSync(file, body);
  try {
    return fn(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

test("fixture coverage: every catalog id has a fixture file", () => {
  const missing = CATALOG.map((p) => p.id).filter((id) => !fs.existsSync(fixturePathForId(id)));
  assert.deepEqual(missing, [], `missing fixtures for: ${missing.join(", ")}`);
  assert.equal(CATALOG.length, 42, "catalog should register 42 prompts");
});

test("self-diff of every prompt is unchanged and exits 0", () => {
  const proc = runCli(["--json"]);
  assert.equal(proc.status, 0, proc.stderr);
  const parsed = JSON.parse(proc.stdout);
  assert.equal(parsed.summary.total, CATALOG.length);
  assert.equal(parsed.summary.reject, 0);
  assert.equal(parsed.summary.accept, 0);
  assert.equal(parsed.summary.unchanged, CATALOG.length);
  for (const r of parsed.results) assert.equal(r.verdict, "unchanged", r.id);
});

test("runDiff loads the fixture and renders base identically when no candidate", () => {
  const r = runDiff({ id: "notice.pending_task", candidatePath: null, root: REPO_ROOT });
  assert.equal(r.changed, false);
  assert.equal(r.verdict, "unchanged");
  assert.ok(r.baseRender.includes("task-42"));
  assert.ok(r.baseRender.includes("RUNNING"));
});

test("candidate dropping a mustContain is rejected (exit 1)", () => {
  withTempCandidate("Consider using something else entirely instead.\n", (file) => {
    const proc = runCli(["--id", "nudge.discovery.grep", "--candidate", file, "--json"]);
    assert.equal(proc.status, 1, proc.stdout);
    const parsed = JSON.parse(proc.stdout);
    assert.equal(parsed.results.length, 1);
    assert.equal(parsed.results[0].verdict, "reject");
    assert.equal(parsed.results[0].restrictionIntegrity.ok, false);
    assert.ok(parsed.results[0].restrictionIntegrity.missing.length > 0);
  });
});

test("token reduction alone never yields accept (quality over tokens)", () => {
  withTempCandidate("use grep\n", (file) => {
    const proc = runCli(["--id", "nudge.discovery.grep", "--candidate", file, "--json"]);
    assert.equal(proc.status, 1, proc.stdout);
    const parsed = JSON.parse(proc.stdout);
    const r = parsed.results[0];
    assert.ok(r.tokensDelta < 0, `expected fewer tokens, got delta ${r.tokensDelta}`);
    assert.equal(r.verdict, "reject");
  });
});

test("--eval prints the skip notice and performs no network I/O", () => {
  const proc = runCli(["--id", "nudge.discovery.grep", "--eval"]);
  assert.equal(proc.status, 0, proc.stderr);
  assert.ok(proc.stdout.includes(EVAL_SKIP_NOTICE), proc.stdout);
  // JSON mode records the skip deterministically without touching the network.
  const jsonProc = runCli(["--id", "nudge.discovery.grep", "--eval", "--json"]);
  assert.equal(jsonProc.status, 0, jsonProc.stderr);
  const parsed = JSON.parse(jsonProc.stdout);
  assert.equal(parsed.eval.requested, true);
  assert.equal(parsed.eval.status, "skipped");
});
