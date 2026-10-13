import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runChecks } from "./prompts-check.mjs";

const roots = [];
after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

function makeRepo({ prompts = {}, catalog, extra = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-prompts-check-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "prompts"), { recursive: true });
  fs.writeFileSync(path.join(root, "prompts", "index.json"), JSON.stringify(catalog ?? {}, null, 2));
  for (const [rel, content] of Object.entries(prompts)) {
    const abs = path.join(root, "prompts", rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  for (const [rel, content] of Object.entries(extra)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

function promptFile({ id = "test.prompt", inputs = [], body = "Body text." } = {}) {
  return [
    "---",
    `id: ${id}`,
    `name: ${id}`,
    "purpose: A test prompt",
    "consumer: tests",
    `inputs: [${inputs.join(", ")}]`,
    "output: text",
    "restrictions: none",
    "verification: none",
    "dependencies: none",
    "status: active",
    "---",
    body,
    "",
  ].join("\n");
}

function entry(over = {}) {
  return {
    id: "test.prompt",
    path: "misc/test.md",
    status: "active",
    responsibility: "Owns the test prompt.",
    consumers: ["src/consumer.js#useIt"],
    testRefs: ["src/characterization.test.mjs"],
    ...over,
  };
}

const VALID_CONSUMER = 'export function useIt() {\n  return loadPrompt("test.prompt");\n}\n';
const VALID_TESTREF = "// characterization fixture\n";

function base({ entryOver = {}, prompt = promptFile(), consumer = VALID_CONSUMER, testRef = VALID_TESTREF } = {}) {
  return makeRepo({
    prompts: { "misc/test.md": prompt },
    catalog: { prompts: [entry(entryOver)] },
    extra: { "src/consumer.js": consumer, "src/characterization.test.mjs": testRef },
  });
}

function has(violations, needle) {
  return violations.some((v) => `${v.scope}: ${v.problem}`.includes(needle));
}

test("happy path: valid catalog with interpolated prompt passes", () => {
  const root = base({ prompt: promptFile({ inputs: ["name"], body: "Hi {{name}}." }) });
  const result = runChecks({ root });
  assert.equal(result.ok, true, JSON.stringify(result.violations));
  assert.deepEqual(result.violations, []);
  assert.equal(result.count, 1);
});

test("duplicate id is reported", () => {
  const root = makeRepo({
    prompts: { "misc/test.md": promptFile() },
    catalog: { prompts: [entry(), entry()] },
    extra: { "src/consumer.js": VALID_CONSUMER, "src/characterization.test.mjs": VALID_TESTREF },
  });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, 'duplicate id "test.prompt"'));
});

test("path escaping prompts/ is reported", () => {
  const root = makeRepo({
    catalog: { prompts: [entry({ path: "../evil.md" })] },
    extra: { "src/consumer.js": VALID_CONSUMER, "src/characterization.test.mjs": VALID_TESTREF },
  });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, "escapes prompts/"));
});

test("absolute path is reported", () => {
  const root = makeRepo({
    catalog: { prompts: [entry({ path: "/etc/hosts" })] },
    extra: { "src/consumer.js": VALID_CONSUMER, "src/characterization.test.mjs": VALID_TESTREF },
  });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, "must be relative"));
});

test("non-markdown path is reported", () => {
  const root = makeRepo({
    catalog: { prompts: [entry({ path: "misc/test.txt" })] },
    extra: { "src/consumer.js": VALID_CONSUMER, "src/characterization.test.mjs": VALID_TESTREF },
  });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, "must be a .md file"));
});

test("missing prompt file is reported", () => {
  const root = base({ entryOver: { path: "misc/missing.md" } });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, "path does not exist: misc/missing.md"));
});

test("undeclared placeholder is reported", () => {
  const root = base({ prompt: promptFile({ inputs: [], body: "Hi {{name}}." }) });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, "undeclared placeholder {{name}}"));
});

test("unused declared input is reported", () => {
  const root = base({ prompt: promptFile({ inputs: ["name"], body: "No placeholders." }) });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, 'declared input "name" is never used'));
});

test("missing consumer file is reported", () => {
  const root = base({ entryOver: { consumers: ["src/nope.js"] } });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, "consumer file not found: src/nope.js"));
});

test("missing consumer symbol is reported", () => {
  const root = base({ entryOver: { consumers: ["src/consumer.js#absentSymbol"] } });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, 'consumer symbol "absentSymbol" not found'));
});

test("missing test reference is reported", () => {
  const root = base({ entryOver: { testRefs: ["src/missing.test.mjs"] } });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, "testRef not found: src/missing.test.mjs"));
});

test("orphan prompt (registered but unused) is reported", () => {
  const root = base({ consumer: "export function useIt() {\n  return 1;\n}\n" });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, "registered prompt has no loadPrompt() usage"));
});

test("unregistered usage is reported", () => {
  const root = base({ consumer: 'export function useIt() {\n  return loadPrompt("ghost.prompt");\n}\n' });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, 'loadPrompt("ghost.prompt") is not registered'));
});

test("non-literal loadPrompt argument is skipped", () => {
  const root = base({
    consumer:
      'export function useIt() {\n  return loadPrompt("test.prompt") || loadPrompt(dynamicId);\n}\n',
  });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, true, JSON.stringify(violations));
});

test("test-source loadPrompt calls do not satisfy usage", () => {
  const root = base({
    consumer: "export function useIt() {\n  return 1;\n}\n",
    testRef: 'const x = loadPrompt("test.prompt");\n',
  });
  const { ok, violations } = runChecks({ root });
  assert.equal(ok, false);
  assert.ok(has(violations, "registered prompt has no loadPrompt() usage"));
});
