// Strategy tool coverage — ordinary host tools must be covered by the default
// approved strategy, and the extracted fallback classifier must bind command
// capabilities against the real executable + argv.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import plugin from "../../index.js";
import { getTaskState } from "../../src/skills/engine.js";

function extractClassifier() {
  const src = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "index.js"), "utf-8");
  const match = src.match(/function classifyActionAgainstStrategy[\s\S]*?\n\}/);
  assert.ok(match, "classifyActionAgainstStrategy must exist");
  return new Function(`${match[0]}; return classifyActionAgainstStrategy;`)();
}

function approvedStrategy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-cover-"));
  const taskId = "task-coverage";
  const dir = path.join(root, ".wam", "tasks", taskId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "task.json"), JSON.stringify({
    contract: { status: "PROPOSED", objective: "Coverage test", rigor: "NORMAL", requirements: [] },
    requirements: [],
    lastAction: "",
    phase: "PROPOSED",
  }, null, 2));
  const approved = plugin.approveContract(taskId, root);
  assert.equal(approved.ok, true);
  const state = getTaskState(taskId, root);
  fs.rmSync(root, { recursive: true, force: true });
  return state.approvedStrategy;
}

test("default approved strategy covers ordinary host tools", () => {
  const classify = extractClassifier();
  const strategy = approvedStrategy();
  for (const tool of [
    "read", "glob", "grep", "list", "webfetch",
    "write", "edit", "patch", "multiedit", "apply_patch",
    "bash", "sh", "task", "todowrite", "todoread",
  ]) {
    assert.equal(classify(tool, tool, {}, strategy).covered, true, `${tool} must be covered`);
  }
});

test("tools outside the strategy remain uncovered (fail-closed)", () => {
  const classify = extractClassifier();
  const strategy = approvedStrategy();
  assert.equal(classify("exfiltrate secrets", "mcp_secret", {}, strategy).covered, false);
});

test("prohibited actions stay blocked even when the tool is otherwise covered", () => {
  const classify = extractClassifier();
  const strategy = { status: "ACTIVE", allowedActions: ["bash"], prohibitedActions: ["drop database"] };
  assert.equal(classify("drop database foo", "bash", { command: "drop database foo" }, strategy).covered, false);
});

test("fallback classifier binds command capabilities to executable + argv", () => {
  const classify = extractClassifier();
  const tight = { status: "ACTIVE", allowedActions: ["npm test", "git status"], prohibitedActions: [] };
  assert.equal(classify("npm test", "bash", { command: "npm test" }, tight).covered, true);
  assert.equal(classify("npm test", "bash", { command: "npm test -- --watch" }, tight).covered, true);
  assert.equal(classify("git status", "bash", { command: "git status --short" }, tight).covered, true);
  assert.equal(classify("npm publish", "bash", { command: "npm publish" }, tight).covered, false);
  assert.equal(classify("pnpm test", "bash", { command: "pnpm test" }, tight).covered, false);
});
