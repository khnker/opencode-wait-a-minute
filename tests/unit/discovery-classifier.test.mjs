import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyBash,
  nudgeFor,
  workdirSuggestion,
  evaluateDiscovery,
} from "../../src/policy/discovery-classifier.js";
import { guardAction } from "../../src/execution/runtime-guards.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("guardAction integration: read-only bash gets a nudge", async () => {
  const taskRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wam-discovery-"));
  const result = await guardAction("bash", { command: "grep -rn foo src" }, taskRoot, "test-id");
  assert.equal(result.allowed, true);
  assert.ok(result.nudge, "guardAction should surface the discovery nudge");
});

test("classifyBash: grep is read-only", () => {
  assert.equal(classifyBash("grep -rn foo .").kind, "read-only");
});

test("classifyBash: filtering pipeline stays read-only", () => {
  assert.equal(classifyBash('rg "x" src | wc -l').kind, "read-only");
});

test("classifyBash: ls is read-only", () => {
  assert.equal(classifyBash("ls -la").kind, "read-only");
});

test("classifyBash: cat is read-only", () => {
  assert.equal(classifyBash("cat package.json").kind, "read-only");
});

test("classifyBash: find is read-only", () => {
  assert.equal(classifyBash('find . -name "*.js"').kind, "read-only");
});

test("classifyBash: cd + build script is justified", () => {
  assert.equal(classifyBash("cd src && npm run build").kind, "justified");
});

test("classifyBash: output redirection is justified", () => {
  assert.equal(classifyBash("echo hi > f.txt").kind, "justified");
});

test("classifyBash: bare script runner is justified", () => {
  assert.equal(classifyBash("npm test").kind, "justified");
});

test("classifyBash: non-filtering pipeline is justified", () => {
  assert.equal(classifyBash("grep x . | tee out").kind, "justified");
});

test("classifyBash: empty and non-string input do not throw", () => {
  assert.equal(classifyBash("").kind, "justified");
  assert.equal(classifyBash(null).kind, "justified");
  assert.equal(classifyBash(123).kind, "justified");
});

test("nudgeFor: returns actionable suggestion for discovery", () => {
  const nudge = nudgeFor("grep -rn foo .");
  assert.equal(typeof nudge, "string");
  assert.match(nudge, /grep/);
});

test("nudgeFor: null for justified commands", () => {
  assert.equal(nudgeFor("npm test"), null);
  assert.equal(nudgeFor("cd src && npm run build"), null);
});

test("workdirSuggestion: suggests workdir for cd", () => {
  const suggestion = workdirSuggestion("cd src && npm test");
  assert.equal(typeof suggestion, "string");
  assert.match(suggestion, /workdir/);
});

test("workdirSuggestion: null when no cd", () => {
  assert.equal(workdirSuggestion("ls -la"), null);
});

test("evaluateDiscovery: null for non-bash tools", () => {
  assert.equal(evaluateDiscovery("read", { filePath: "x" }), null);
  assert.equal(evaluateDiscovery("task", { prompt: "x" }), null);
});

test("evaluateDiscovery: classifies bash and attaches nudge", () => {
  const discovery = evaluateDiscovery("bash", { command: "grep -rn foo ." });
  assert.equal(discovery.kind, "read-only");
  assert.equal(typeof discovery.nudge, "string");

  const justified = evaluateDiscovery("bash", { command: "npm test" });
  assert.equal(justified.kind, "justified");
  assert.equal(justified.nudge, null);
});

test("evaluateDiscovery: malformed input does not throw", () => {
  assert.doesNotThrow(() => evaluateDiscovery("bash", {}));
  assert.doesNotThrow(() => evaluateDiscovery(undefined, undefined));
});
