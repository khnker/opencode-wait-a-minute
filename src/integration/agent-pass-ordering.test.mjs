import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../../index.js", import.meta.url), "utf8");

test("agent passes are dispatched only from the idle task loop", () => {
  const calls = [...source.matchAll(/runTaskAgentPass\(/g)].map((m) => m.index);
  assert.equal(calls.length, 2, "expected one definition and one call site");
  const maybeTaskLoop = source.indexOf("async function maybeTaskLoop(");
  assert.ok(maybeTaskLoop >= 0, "maybeTaskLoop must exist");
  const callSite = Math.max(...calls);
  assert.ok(callSite > maybeTaskLoop, "the only call site must be inside maybeTaskLoop (post-idle)");
  assert.doesNotMatch(source, /early agent pass/i);
});

test("an in-flight agent pass keeps the idle dispatch retrying", () => {
  assert.match(
    source,
    /if \(agentRunInFlight\.has\(taskId\)\) return \{ reason: "in-flight" \};/,
    "maybeTaskLoop must signal in-flight so dispatchIdle keeps polling instead of stranding the task",
  );
});
