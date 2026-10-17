import { test } from "node:test";
import { strict as assert } from "node:assert";
import { enforceNoScratchScripts } from "../../src/policy/governance-enforcement.js";

test("enforceNoScratchScripts returns null for non-mutating tools", () => {
  assert.strictEqual(enforceNoScratchScripts("read", { filePath: "/tmp/test_tipo.js" }), null);
  assert.strictEqual(enforceNoScratchScripts("grep", { pattern: "x" }), null);
});

test("enforceNoScratchScripts returns null for normal repo paths", () => {
  assert.strictEqual(
    enforceNoScratchScripts("write", { filePath: "/repo/src/foo.js" }),
    null
  );
  assert.strictEqual(
    enforceNoScratchScripts("write", { filePath: "/repo/tests/unit/loop-budget-guard.test.mjs" }),
    null
  );
});

test("enforceNoScratchScripts blocks ad-hoc test_ script in /tmp", () => {
  const r = enforceNoScratchScripts("write", { filePath: "/tmp/test_tipo.js" });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.reason, "scratch-script");
  assert.match(r.directive, /Script temporal detectado/);
});

test("enforceNoScratchScripts blocks debug_ script in /tmp", () => {
  const r = enforceNoScratchScripts("write", { filePath: "/tmp/debug_full.js" });
  assert.strictEqual(r.allowed, false);
  assert.match(r.directive, /Script temporal detectado/);
});

test("enforceNoScratchScripts blocks scratch- prefixed files", () => {
  const r = enforceNoScratchScripts("write", { filePath: "/repo/scratch-repro.mjs" });
  assert.strictEqual(r.allowed, false);
});

test("enforceNoScratchScripts redirects to existing test when stem matches", () => {
  const existing = ["/repo/tests/unit/loop-budget-guard.test.mjs"];
  const r = enforceNoScratchScripts("write", { filePath: "/tmp/test_loop_budget.js" }, { existingTests: existing });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.reason, "existing-test-found");
  assert.match(r.directive, /loop-budget-guard.test.mjs/);
});

test("enforceNoScratchScripts allows when no existing test matches", () => {
  const existing = ["/repo/tests/unit/some-other.test.mjs"];
  const r = enforceNoScratchScripts("write", { filePath: "/tmp/test_tipo.js" }, { existingTests: existing });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.reason, "scratch-script");
});

test("enforceNoScratchScripts handles edit/patch tools too", () => {
  assert.strictEqual(
    enforceNoScratchScripts("edit", { filePath: "/tmp/test_xyz.js" })?.allowed,
    false
  );
  assert.strictEqual(
    enforceNoScratchScripts("apply_patch", { filePath: "/tmp/test_abc.js" })?.allowed,
    false
  );
});

test("enforceNoScratchScripts returns null when no filePath", () => {
  assert.strictEqual(enforceNoScratchScripts("write", {}), null);
  assert.strictEqual(enforceNoScratchScripts("write", { filePath: null }), null);
});

test("enforceNoScratchScripts detects scratch dir", () => {
  const r = enforceNoScratchScripts("write", { filePath: "/repo/scratch/foo.js" });
  assert.strictEqual(r.allowed, false);
});

test("enforceNoScratchScripts detects diagnostics dir", () => {
  const r = enforceNoScratchScripts("write", { filePath: "/repo/diagnostics/foo.js" });
  assert.strictEqual(r.allowed, false);
});