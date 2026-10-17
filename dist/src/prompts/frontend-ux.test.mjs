/**
 * Frontend UX prompt suite tests.
 *
 * Verifies three contracts:
 *  1. frontmatter conformance — every suite prompt declares the full contract.
 *  2. catalog validation — the suite registers cleanly in `prompts/index.json`
 *     (delegated to the shared `runChecks` integrity checker).
 *  3. loader round-trips — suite prompts load through WAM's central loader and
 *     render byte-identically to their own bodies.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadPrompt, listPrompts, parseFrontmatter } from "./loader.js";
import {
  FRONTEND_UX_PROMPT_IDS,
  loadFrontendUxManifest,
  loadFrontendUxPrompt,
} from "./frontend-ux.js";
import { runChecks } from "../../scripts/prompts-check.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SUITE_DIR = path.join(REPO_ROOT, "prompts", "frontend-ux");

// Fields the catalog integrity checker requires on every registered prompt file.
const REQUIRED_FRONTMATTER_FIELDS = [
  "id",
  "name",
  "purpose",
  "consumer",
  "inputs",
  "output",
  "restrictions",
  "verification",
  "dependencies",
  "status",
];

// Extra contract fields the frontend-ux suite spec requires per prompt.
const SUITE_CONTRACT_FIELDS = [
  "version",
  "activation",
  "requiredInput",
  "expectedOutput",
  "constraints",
  "evidenceRequirements",
  "fallback",
  "relatedTo",
];

const manifest = loadFrontendUxManifest();
const manifestById = new Map(manifest.prompts.map((p) => [p.id, p]));

function readSuitePrompt(id) {
  const meta = manifestById.get(id);
  assert.ok(meta, `manifest is missing prompt "${id}"`);
  const raw = fs.readFileSync(path.join(SUITE_DIR, meta.file), "utf8");
  return parseFrontmatter(raw);
}

test("manifest: declares the five suite prompts with unique ids and semver versions", () => {
  assert.equal(manifest.suite, "frontend-ux");
  assert.deepEqual(
    manifest.prompts.map((p) => p.id),
    [...FRONTEND_UX_PROMPT_IDS],
  );
  assert.equal(new Set(manifest.prompts.map((p) => p.id)).size, 5);
  for (const p of manifest.prompts) {
    assert.match(p.version, /^\d+\.\d+\.\d+$/, `bad version for ${p.id}`);
    assert.ok(fs.existsSync(path.join(SUITE_DIR, p.file)), `missing file for ${p.id}`);
  }
});

test("manifest: files declare the id and version the manifest references", () => {
  for (const id of FRONTEND_UX_PROMPT_IDS) {
    const meta = manifestById.get(id);
    const { data, body } = readSuitePrompt(id);
    assert.equal(data.id, id, `frontmatter id mismatch in ${meta.file}`);
    assert.equal(data.version, meta.version, `frontmatter version mismatch in ${meta.file}`);
    assert.ok(body.trim().length > 0, `empty body in ${meta.file}`);
  }
});

test("frontmatter conformance: every prompt declares the full contract", () => {
  for (const id of FRONTEND_UX_PROMPT_IDS) {
    const { data } = readSuitePrompt(id);
    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(data, field),
        `${id} is missing frontmatter field "${field}"`,
      );
    }
    for (const field of SUITE_CONTRACT_FIELDS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(data, field),
        `${id} is missing suite contract field "${field}"`,
      );
    }
    assert.ok(String(data.purpose).length > 0, `${id} has an empty purpose`);
    assert.ok(String(data.expectedOutput).length > 0, `${id} has an empty expectedOutput`);
    assert.ok(Array.isArray(data.relatedTo), `${id} relatedTo must be an array`);
    assert.ok(data.relatedTo.length > 0, `${id} relatedTo must not be empty`);
    for (const ref of data.relatedTo) {
      assert.ok(manifestById.has(ref), `${id} references unknown prompt "${ref}"`);
      assert.ok(FRONTEND_UX_PROMPT_IDS.includes(ref), `${id} references unknown prompt "${ref}"`);
    }
  }
});

test("frontmatter conformance: findings distinguish observed defects from hypotheses", () => {
  for (const id of FRONTEND_UX_PROMPT_IDS) {
    const { body } = readSuitePrompt(id);
    const lowered = body.toLowerCase();
    assert.ok(lowered.includes("observed"), `${id} must mention observed findings`);
    assert.ok(lowered.includes("hypothesis"), `${id} must mention hypotheses`);
  }
});

test("catalog validation: runChecks reports no violations", () => {
  const result = runChecks({ root: REPO_ROOT });
  assert.deepEqual(result.violations, [], JSON.stringify(result.violations, null, 2));
  assert.equal(result.ok, true);
});

test("catalog registration: the suite ids are registered in prompts/index.json", () => {
  const ids = new Set(listPrompts().map((e) => e.id));
  for (const id of FRONTEND_UX_PROMPT_IDS) {
    assert.ok(ids.has(id), `${id} is not registered in prompts/index.json`);
  }
});

test("loader round-trips: suite prompts load byte-identically through the central loader", () => {
  for (const id of FRONTEND_UX_PROMPT_IDS) {
    const { body } = readSuitePrompt(id);
    const vars = { context: "ROUND-TRIP-CONTEXT" };
    const rendered = loadPrompt(id, vars);
    assert.equal(rendered, body.replace(/\{\{\s*context\s*\}\}/g, vars.context));
    assert.equal(loadFrontendUxPrompt(id, vars), rendered);
  }
});
