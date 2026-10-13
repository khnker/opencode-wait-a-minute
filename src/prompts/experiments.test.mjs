/**
 * Experiment guard tests — experimental variants must never enter the active
 * prompt catalog, and the integrity check must ignore `prompts/experiments/**`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listPrompts, clearCache } from "./loader.js";
import { runChecks } from "../../scripts/prompts-check.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const PROMPTS_ROOT = path.join(REPO_ROOT, "prompts");
const EXPERIMENTS_ROOT = path.join(PROMPTS_ROOT, "experiments");

const EXPECTED_VARIANTS = [
  ["verify", "V1"],
  ["scope", "S1"],
  ["simplify", "P1"],
  ["delegation", "D1"],
];

test("experiments: the four variants exist on disk", () => {
  for (const [policy, variant] of EXPECTED_VARIANTS) {
    const rel = path.join(EXPERIMENTS_ROOT, policy, `${variant}.md`);
    assert.ok(fs.existsSync(rel), `missing experimental variant: ${rel}`);
  }
});

test("experiments: active prompt count is unchanged and exposes no variant", () => {
  clearCache();
  const active = listPrompts();
  assert.ok(Array.isArray(active) && active.length > 0, "active catalog is empty");
  const catalog = JSON.parse(
    fs.readFileSync(path.join(PROMPTS_ROOT, "index.json"), "utf8"),
  );
  const registered = Array.isArray(catalog) ? catalog : catalog.prompts;
  assert.equal(
    active.length,
    registered.length,
    "active prompt count changed after adding experiments",
  );
  const experimentIds = EXPECTED_VARIANTS.map(([p, v]) => `policy.${p}.${v}`);
  for (const entry of active) {
    assert.ok(
      !String(entry.path).split("/").includes("experiments"),
      `experimental path exposed as active: ${entry.path}`,
    );
    assert.ok(
      !experimentIds.includes(entry.id),
      `experimental id exposed as active: ${entry.id}`,
    );
  }
});

test("experiments: integrity check ignores prompts/experiments/**", () => {
  const result = runChecks({ root: REPO_ROOT });
  assert.deepEqual(result.violations, [], "unexpected integrity violations");
  assert.ok(result.ok, "integrity check failed after adding experiments");
  clearCache();
  assert.equal(
    result.count,
    listPrompts().length,
    "checked prompt count diverges from the active catalog",
  );
});
