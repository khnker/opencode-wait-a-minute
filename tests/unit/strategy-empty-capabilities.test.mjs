import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const indexSrc = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "index.js"), "utf-8");
const match = indexSrc.match(/function classifyActionAgainstStrategy[\s\S]*?\n\}/);
if (!match) throw new Error("classifyActionAgainstStrategy not found in index.js");

function load() {
  return new Function(`${match[0]}; return classifyActionAgainstStrategy;`)();
}
const classify = load();

test("a strategy with no configured capabilities falls through instead of flagging a violation", () => {
  const verdict = classify("edit", "edit", {}, {
    status: "ACTIVE",
    allowedActions: [],
    prohibitedActions: [],
  });
  assert.equal(verdict.covered, null);
  assert.equal(verdict.reason, "no-capabilities-configured");
});

test("explicit prohibitions are still enforced when no allowlist is configured", () => {
  const verdict = classify("rm -rf data", "bash", { command: "rm -rf data" }, {
    status: "ACTIVE",
    allowedActions: [],
    prohibitedActions: ["bash"],
  });
  assert.equal(verdict.covered, false);
});
