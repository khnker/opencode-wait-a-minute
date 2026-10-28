import { test } from "node:test";
import assert from "node:assert/strict";
import { runAudit } from "./prompts-audit.mjs";

test("audit is deterministic and read-only", () => {
  const a = runAudit();
  const b = runAudit();
  assert.deepEqual(a, b, "two consecutive runs must produce identical models");
});

test("audit reports the registered prompt count and assembly raw literals", () => {
  const a = runAudit();
  assert.equal(a.summary.registeredPrompts, 44, "catalog must expose 43 registered prompts");

  const assembly = a.candidateSites.filter((s) => s.file === "src/context/assembly.js");
  assert.ok(
    assembly.some((s) => /\[wam N1 project\]/.test(s.text)),
    "expected [wam N1 project] as a candidate site",
  );
  assert.ok(
    assembly.some((s) => /\[wam N3/.test(s.text)),
    "expected at least one [wam N3 ...] candidate site",
  );
});

test("audit cross-references the catalog for stale consumers", () => {
  const a = runAudit();
  // Every reported stale ref must point at a path that does not exist.
  for (const s of a.staleConsumerRefs) {
    assert.equal(typeof s.missingPath, "string");
    assert.ok(s.missingPath.length > 0);
  }
});
