/**
 * Offline tests for judge calibration + gold capture plumbing.
 *
 * No network: the capture test runs the CLI with `--dry-run`, which selects the
 * bundled mock provider via `resolveProvider`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  computeKappa,
  calibrate,
  collectOracleVerdicts,
  loadGold,
  serializeCalibration,
  GATE_THRESHOLDS,
} from "./calibrate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const CAPTURE_SCRIPT = path.join(ROOT, "scripts", "prompts-capture-gold.mjs");

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeSuite(id, specs, promptRef = "policy.verify.rules") {
  const byScenario = new Map();
  for (const spec of specs) {
    if (!byScenario.has(spec.scenarioId)) byScenario.set(spec.scenarioId, []);
    byScenario.get(spec.scenarioId).push({
      id: spec.criterionId,
      required: spec.required ?? true,
      description: spec.criterionId,
      oracle: { kind: spec.oracleKind ?? "includes-any", values: ["x"] },
    });
  }
  const scenarios = [...byScenario.entries()].map(([scenarioId, criteria]) => ({
    id: scenarioId,
    suite: id,
    severity: "high",
    context: "",
    promptRef,
    expectation: "",
    criteria,
  }));
  return { id, version: "1.0.0", description: "", scenarios };
}

function materialize(suiteId, pairs) {
  const oracleVerdicts = { [suiteId]: {} };
  const labels = { [suiteId]: {} };
  for (const p of pairs) {
    oracleVerdicts[suiteId][p.scenarioId] ??= {};
    labels[suiteId][p.scenarioId] ??= {};
    oracleVerdicts[suiteId][p.scenarioId][p.criterionId] = {
      passed: p.oraclePass === true,
      evaluable: p.evaluable !== false,
      oracleKind: p.oracleKind ?? "includes-any",
      required: p.required ?? true,
    };
    labels[suiteId][p.scenarioId][p.criterionId] = {
      label: p.goldPass ? "pass" : "fail",
      rationale: "test rationale",
    };
  }
  return { oracleVerdicts, labels };
}

// --- κ math ---------------------------------------------------------------

test("computeKappa: perfect agreement yields κ=1", () => {
  const r = computeKappa([true, true, false, false], [true, true, false, false]);
  assert.equal(r.kappa, 1);
  assert.equal(r.po, 1);
  assert.equal(r.n, 4);
  assert.deepEqual(r.confusion, { tp: 2, fp: 0, tn: 2, fn: 0 });
  assert.equal(r.precision, 1);
  assert.equal(r.recall, 1);
  assert.equal(r.f1, 1);
});

test("computeKappa: chance-level agreement yields κ=0", () => {
  const r = computeKappa([true, true, false, false], [true, false, true, false]);
  assert.equal(r.kappa, 0);
  assert.equal(r.po, 0.5);
  assert.equal(r.pe, 0.5);
  assert.deepEqual(r.confusion, { tp: 1, fp: 1, tn: 1, fn: 1 });
});

test("computeKappa: precision/recall/f1 on an asymmetric matrix", () => {
  const r = computeKappa([true, true, false, false], [true, true, true, false]);
  assert.deepEqual(r.confusion, { tp: 2, fp: 0, tn: 1, fn: 1 });
  assert.equal(r.precision, 1);
  assert.ok(Math.abs(r.recall - 2 / 3) < 1e-12);
  assert.ok(Math.abs(r.f1 - 0.8) < 1e-12);
});

test("computeKappa: degenerate (zero-denominator → null with reason, not NaN)", () => {
  const r = computeKappa([true, true], [true, true]);
  assert.equal(r.kappa, null);
  assert.equal(r.pe, 1);
  assert.match(r.reason, /chance agreement is 1/);
  assert.ok(!Number.isNaN(r.kappa));
});

test("computeKappa: empty inputs → null with reason", () => {
  const r = computeKappa([], []);
  assert.equal(r.kappa, null);
  assert.equal(r.n, 0);
  assert.match(r.reason, /no pairs/);
});

test("computeKappa: length mismatch throws", () => {
  assert.throws(() => computeKappa([true], [true, false]), /length mismatch/);
});

// --- gate -----------------------------------------------------------------

test("gate: overall κ < 0.6 fails", () => {
  const specs = [
    { scenarioId: "s1", criterionId: "c1" },
    { scenarioId: "s2", criterionId: "c1" },
  ];
  const suite = makeSuite("s", specs);
  const { oracleVerdicts, labels } = materialize("s", [
    { scenarioId: "s1", criterionId: "c1", oraclePass: true, goldPass: false },
    { scenarioId: "s2", criterionId: "c1", oraclePass: true, goldPass: false },
  ]);
  const cal = calibrate({ suites: [suite], gold: labels, oracleVerdicts });
  assert.ok(cal.overall.kappa < GATE_THRESHOLDS.overallKappa);
  assert.equal(cal.gate.status, "fail");
  assert.ok(cal.gate.reasons.some((r) => r.includes("overall κ")));
});

test("gate: per-criterion κ < 0.4 fails while overall passes", () => {
  const specs = [];
  const pairs = [];
  const oracleA = [true, true, true, true, true, false, false, false, false, false];
  const goldA = [true, true, true, true, true, false, false, false, false, false];
  for (let i = 0; i < 10; i += 1) {
    specs.push({ scenarioId: `a${i}`, criterionId: "cA" });
    pairs.push({ scenarioId: `a${i}`, criterionId: "cA", oraclePass: oracleA[i], goldPass: goldA[i] });
  }
  const oracleB = [true, true, true, false];
  const goldB = [true, false, false, false];
  for (let i = 0; i < 4; i += 1) {
    specs.push({ scenarioId: `b${i}`, criterionId: "cB" });
    pairs.push({ scenarioId: `b${i}`, criterionId: "cB", oraclePass: oracleB[i], goldPass: goldB[i] });
  }
  const suite = makeSuite("s", specs);
  const { oracleVerdicts, labels } = materialize("s", pairs);
  const cal = calibrate({ suites: [suite], gold: labels, oracleVerdicts });

  assert.ok(cal.overall.kappa >= GATE_THRESHOLDS.overallKappa, `overall κ=${cal.overall.kappa}`);
  const cB = cal.criteria.find((c) => c.criterionId === "cB");
  assert.ok(cB.kappa < GATE_THRESHOLDS.criterionKappa, `cB κ=${cB.kappa}`);
  assert.equal(cal.gate.status, "fail");
  assert.ok(cal.gate.reasons.some((r) => r.includes("cB") && r.includes("< 0.4")));
});

test("gate: negation-guard false positive fails", () => {
  const suite = makeSuite("s", [
    { scenarioId: "s1", criterionId: "c1", oracleKind: "not-matches" },
  ]);
  const { oracleVerdicts, labels } = materialize("s", [
    { scenarioId: "s1", criterionId: "c1", oraclePass: true, goldPass: false, oracleKind: "not-matches" },
  ]);
  const cal = calibrate({ suites: [suite], gold: labels, oracleVerdicts });
  const c1 = cal.criteria.find((c) => c.criterionId === "c1");
  assert.equal(c1.negationGuard, true);
  assert.equal(c1.confusion.fp, 1);
  assert.equal(cal.gate.status, "fail");
  assert.ok(cal.gate.reasons.some((r) => r.includes("negation guard false positive")));
});

test("gate: required criterion with zero pairs is flagged uncalibrated", () => {
  const suite = makeSuite("s", [{ scenarioId: "s1", criterionId: "c1" }]);
  const { oracleVerdicts, labels } = materialize("s", [
    { scenarioId: "s1", criterionId: "c1", oraclePass: true, goldPass: true, evaluable: false },
  ]);
  const cal = calibrate({ suites: [suite], gold: labels, oracleVerdicts });
  assert.equal(cal.gate.status, "fail");
  assert.ok(cal.gate.reasons.some((r) => r.includes("uncalibrated")));
});

// --- determinism ----------------------------------------------------------

test("serializeCalibration is byte-identical across repeats (no timestamps)", () => {
  const suite = makeSuite("s", [
    { scenarioId: "s1", criterionId: "c1" },
    { scenarioId: "s2", criterionId: "c2", oracleKind: "not-matches" },
  ]);
  const { oracleVerdicts, labels } = materialize("s", [
    { scenarioId: "s1", criterionId: "c1", oraclePass: true, goldPass: true },
    { scenarioId: "s2", criterionId: "c2", oraclePass: false, goldPass: false, oracleKind: "not-matches" },
  ]);
  const cal = calibrate({ suites: [suite], gold: labels, oracleVerdicts });
  const a = serializeCalibration(cal);
  const b = serializeCalibration(cal);
  assert.equal(a, b);
  assert.equal(a, `${JSON.stringify(JSON.parse(a), null, 2)}\n`);
  assert.doesNotMatch(a, /\d{4}-\d{2}-\d{2}T/);
});

// --- oracle verdict recomputation -----------------------------------------

test("collectOracleVerdicts marks missing outputs as not evaluable", () => {
  const suite = makeSuite("s", [{ scenarioId: "s1", criterionId: "c1" }]);
  const verdicts = collectOracleVerdicts({ suites: [suite], outputs: {} });
  assert.equal(verdicts.s.s1.c1.evaluable, false);
  assert.equal(verdicts.s.s1.c1.passed, false);
});

// --- gold loader ----------------------------------------------------------

test("loadGold: valid fixture loads and normalizes labels", () => {
  const dir = tmpDir("gold-valid-");
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify({
      schema: "wam.prompt-eval.gold/1",
      version: "v1-provisional",
      provenance: "agent-authored single-annotator (PROVISIONAL)",
      model: "mock/dry-run",
      temperature: 0,
    }),
  );
  fs.writeFileSync(
    path.join(dir, "labels.json"),
    JSON.stringify({ verify: { "s1": { "c1": { label: "pass", rationale: "ok" } } } }),
  );
  const gold = loadGold(dir);
  assert.deepEqual(gold.errors, []);
  assert.equal(gold.version, "v1-provisional");
  assert.equal(gold.labels.verify.s1.c1.label, "pass");
  assert.equal(gold.labels.verify.s1.c1.rationale, "ok");
});

test("loadGold: missing labels file is reported as an error, not thrown", () => {
  const dir = tmpDir("gold-nolabels-");
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify({ version: "v1-provisional", provenance: "x" }),
  );
  const gold = loadGold(dir);
  assert.ok(gold.errors.some((e) => e.includes("labels.json missing")));
  assert.deepEqual(gold.labels, {});
});

test("loadGold: invalid label value is reported", () => {
  const dir = tmpDir("gold-badlabel-");
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ version: "v1", provenance: "x" }));
  fs.writeFileSync(
    path.join(dir, "labels.json"),
    JSON.stringify({ verify: { s1: { c1: { label: "maybe", rationale: "?" } } } }),
  );
  const gold = loadGold(dir);
  assert.ok(gold.errors.some((e) => e.includes('must be "pass" or "fail"')));
});

// --- capture CLI (mock provider, offline) ---------------------------------

test("capture CLI --dry-run writes raw/<suite>.json + meta.json", () => {
  const out = tmpDir("gold-dry-");
  execFileSync(
    process.execPath,
    [CAPTURE_SCRIPT, "--dry-run", "--suite", "verify", "--out", out],
    { encoding: "utf8" },
  );

  const rawPath = path.join(out, "raw", "verify.json");
  const metaPath = path.join(out, "meta.json");
  assert.ok(fs.existsSync(rawPath), "raw/verify.json written");
  assert.ok(fs.existsSync(metaPath), "meta.json written");

  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  assert.equal(raw.suite, "verify");
  assert.equal(raw.temperature, 0);
  assert.equal(raw.model, "mock/dry-run");
  assert.equal(Object.keys(raw.outputs).length, 2);
  assert.ok(raw.usage && typeof raw.usage.tokens === "object");

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  assert.equal(meta.version, "v1-provisional");
  assert.equal(meta.temperature, 0);
  assert.match(meta.provenance, /single-annotator/);
  assert.equal(meta.model, "mock/dry-run");
});

test("calibration discloses in-sample scope (upper bound, not generalization)", () => {
  const suite = makeSuite("s", [{ scenarioId: "s1", criterionId: "c1" }]);
  const { oracleVerdicts, labels } = materialize("s", [
    { scenarioId: "s1", criterionId: "c1", oraclePass: true, goldPass: true },
  ]);
  const cal = calibrate({ suites: [suite], gold: labels, oracleVerdicts });
  assert.equal(cal.scope, "in-sample");
  assert.equal(JSON.parse(serializeCalibration(cal)).scope, "in-sample");
});

// --- post-recalibration gate (task 5.x) -----------------------------------
test("recalibrated oracles pass the calibration gate on the frozen gold set", async () => {
  const { runCalibration } = await import("../../../scripts/prompts-calibrate.mjs");
  const out = path.join(tmpDir("calib-"), "calibration.json");
  const { cal } = runCalibration({ out });
  assert.equal(cal.gate.status, "pass", `gate reasons: ${JSON.stringify(cal.gate.reasons)}`);
  assert.equal(cal.scope, "in-sample", "artifact must disclose in-sample scope");
  assert.ok(
    cal.overall.kappa >= GATE_THRESHOLDS.overallKappa,
    `overall κ=${cal.overall.kappa} must be ≥ ${GATE_THRESHOLDS.overallKappa}`,
  );
  assert.equal(cal.overall.confusion.fp, 0, "no oracle=pass on gold=fail (precision stays 1.0)");
  assert.equal(cal.overall.precision, 1);
  for (const criterion of cal.criteria) {
    if (criterion.kappa == null) continue;
    assert.ok(
      criterion.kappa >= GATE_THRESHOLDS.criterionKappa,
      `${criterion.criterionId} κ=${criterion.kappa} < ${GATE_THRESHOLDS.criterionKappa}`,
    );
  }
});
test("scripts/prompts-calibrate.mjs exits 0 on the frozen gold set", () => {
  const out = path.join(tmpDir("calib-cli-"), "calibration.json");
  const cli = path.join(ROOT, "scripts", "prompts-calibrate.mjs");
  const stdout = execFileSync(process.execPath, [cli, "--json", "--out", out], { encoding: "utf8" });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.gate.status, "pass");
  assert.equal(parsed.scope, "in-sample");
  assert.ok(parsed.overall.kappa >= GATE_THRESHOLDS.overallKappa);
});
