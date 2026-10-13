import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runChecks } from "../../../scripts/prompts-check.mjs";
import { loadPrompt } from "../../../src/prompts/loader.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("prompt-eval integration", () => {
  it("PQ-INT-007: existing prompts catalog validator still works", async () => {
    const { ok, violations } = runChecks({ root: repoRoot });
    assert.strictEqual(ok, true, `prompts-check violations: ${JSON.stringify(violations)}`);
  });

  it("PQ-INT-008: current WAM test suite has no regression attributable to new system", async () => {
    const body = loadPrompt("policy.verify.rules", {}, { root: path.join(repoRoot, "prompts") });
    assert.ok(typeof body === "string" && body.length > 0, "Loader must return non-empty prompt body");
  });
});
