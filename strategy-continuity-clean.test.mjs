// strategy-continuity-clean.test.mjs
//
// Regression test for the ESM `require()` bug in the Strategy Continuity path.
//
// Before the fix, index.js resolved structured capabilities via a runtime
// `require("./policy/strategy-capabilities.js")` inside an ESM module. That
// throws `ReferenceError: require is not defined` the moment an approved
// strategy reaches capability loading, which meant strategy continuity was
// silently dead and, once activated, could surface module-loader errors.
//
// This test boots the plugin in a *clean Node process* (no shared module cache
// with the test runner), activates a persisted ACTIVE strategy, and drives
// `tool.execute.before` until it reaches capability loading + candidate
// selection. It asserts the path completes without module-loader errors.

import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLEAN_PROCESS_SCRIPT = `
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { default: waitAMinute } = await import(pathToFileURL(${JSON.stringify(fileURLToPath(new URL("./index.js", import.meta.url)))}).href);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-sc-clean-"));
const taskId = "default-task";
const taskDir = path.join(root, ".wam", "tasks", taskId);
fs.mkdirSync(taskDir, { recursive: true });
fs.writeFileSync(path.join(taskDir, "state.yaml"), JSON.stringify({
  phase: "IMPLEMENTING",
  contract: { status: "APPROVED", objective: "clean process strategy execution", unknowns: [] },
  requirements: [],
  assumptions: [],
  nextAction: null,
  approvedStrategy: {
    strategy: "clean process strategy execution",
    approvedAt: Date.now(),
    scope: "clean process strategy execution",
    allowedActions: ["read", "write", "edit", "npm test"],
    prohibitedActions: ["production deploy", "drop database"],
    invalidationConditions: [],
    status: "ACTIVE",
  },
}, null, 2));

const hooks = await waitAMinute({ directory: root, client: {}, project: {}, $: {} });

// Covered action: reaches buildCandidate + classifyByCapabilities and must pass.
await hooks["tool.execute.before"]({ tool: "write", callID: "c1" }, { args: {} });

// Prohibited command: must surface an explicit strategy violation, proving the
// structured-capability path executed (buildCandidate + classifyByCapabilities)
// rather than being skipped by a module-loader failure.
let violation = null;
try {
  await hooks["tool.execute.before"](
    { tool: "bash", callID: "c2" },
    { args: { command: "production deploy" } }
  );
} catch (e) {
  violation = e;
}

if (!violation) {
  console.error("expected a strategy violation for prohibited action");
  process.exit(2);
}
if (/require is not defined|Cannot find module|ERR_MODULE_NOT_FOUND|ERR_REQUIRE_ESM/.test(violation.message)) {
  console.error("module-loader error leaked: " + violation.message);
  process.exit(3);
}
if (!/STRATEGY VIOLATION|Acción prohibida|no autoriza/.test(violation.message)) {
  console.error("unexpected violation: " + violation.message);
  process.exit(4);
}

fs.rmSync(root, { recursive: true, force: true });
console.log("clean-process-strategy-continuity-ok");
`;

test("Strategy Continuity: capability loading + candidate selection in a clean Node process", () => {
  const out = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", CLEAN_PROCESS_SCRIPT],
    {
      encoding: "utf8",
      cwd: os.tmpdir(),
      env: { ...process.env, WAM_DEBUG_TE: "" },
      timeout: 60000,
    }
  );
  assert.match(out, /clean-process-strategy-continuity-ok/);
});
