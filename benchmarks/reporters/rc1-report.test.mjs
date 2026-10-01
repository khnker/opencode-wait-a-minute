import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateRc1Report } from "./rc1-report.mjs";
import { sha256File } from "./manifest.mjs";

const ARTIFACTS = [
  "manifest.json",
  "raw.json",
  "metrics.json",
  "comparison.json",
  "evidence.json",
  "report.md"
];

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-rc1-report-"));
}

test("generateRc1Report writes all six artifacts", () => {
  const out = tmpDir();
  try {
    generateRc1Report({ outDir: out });
    for (const name of ARTIFACTS) {
      const p = path.join(out, name);
      assert.ok(fs.existsSync(p), `missing artifact ${name}`);
      assert.ok(fs.statSync(p).size > 0, `empty artifact ${name}`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("report.md contains the three section headers", () => {
  const out = tmpDir();
  try {
    generateRc1Report({ outDir: out });
    const md = fs.readFileSync(path.join(out, "report.md"), "utf8");
    assert.match(md, /^## A\. Internal Deterministic$/m);
    assert.match(md, /^## B\. Empirical Real \(dry-run\)$/m);
    assert.match(md, /^## C\. External Evidence$/m);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("each of the three sections is present independently (no merged single figure)", () => {
  const out = tmpDir();
  try {
    generateRc1Report({ outDir: out });
    const metrics = JSON.parse(fs.readFileSync(path.join(out, "metrics.json"), "utf8"));
    assert.ok(metrics.internalDeterministic, "internalDeterministic block missing");
    assert.ok(metrics.empiricalReal, "empiricalReal block missing");
    assert.ok(metrics.externalEvidence, "externalEvidence block missing");

    // The metrics object must NOT contain a top-level merged/net figure.
    const forbidden = ["netSavings", "totalSavings", "overallSavings", "combined", "merged"];
    for (const key of forbidden) {
      assert.equal(key in metrics, false, `merged key ${key} must not exist`);
    }
    assert.equal(metrics.internalDeterministic.netInputSavings, undefined);
    assert.equal(metrics.empiricalReal.totalReductionPct, undefined);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("comparison.json declares it does not merge sections", () => {
  const out = tmpDir();
  try {
    generateRc1Report({ outDir: out });
    const comparison = JSON.parse(
      fs.readFileSync(path.join(out, "comparison.json"), "utf8")
    );
    assert.equal(comparison.merged, false);
    assert.match(comparison.mergePolicy, /No combined figure/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("manifest.json artifacts sha256 match sha256File of the files", () => {
  const out = tmpDir();
  try {
    generateRc1Report({ outDir: out });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(out, "manifest.json"), "utf8")
    );
    assert.ok(Array.isArray(manifest.artifacts));
    assert.equal(manifest.artifacts.length, ARTIFACTS.length - 1);

    for (const a of manifest.artifacts) {
      const p = path.join(out, a.path);
      assert.ok(fs.existsSync(p), `manifest references missing file ${a.path}`);
      assert.equal(a.sha256, sha256File(p), `sha256 mismatch for ${a.path}`);
      assert.equal(a.bytes, fs.statSync(p).size, `byte count mismatch for ${a.path}`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("external evidence section keeps cached tokens separate and caveated", () => {
  const out = tmpDir();
  try {
    generateRc1Report({ outDir: out });
    const evidence = JSON.parse(
      fs.readFileSync(path.join(out, "evidence.json"), "utf8")
    );
    assert.equal(evidence.cachedTokensReportedSeparately, true);
    assert.ok(evidence.sourceCount >= 3);
    assert.match(evidence.cacheCaveat, /NOT evidence of WAM context reduction/);
    assert.match(evidence.cacheCaveat, /reported separately/);

    const metrics = JSON.parse(fs.readFileSync(path.join(out, "metrics.json"), "utf8"));
    // No cached-token number may appear in the internal or empirical blocks.
    const internalAndEmpirical = JSON.stringify({
      i: metrics.internalDeterministic,
      e: metrics.empiricalReal
    });
    assert.doesNotMatch(internalAndEmpirical, /cacheHit|cachedTokens/i);

    const md = fs.readFileSync(path.join(out, "report.md"), "utf8");
    assert.match(md, /Cached tokens are reported separately/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("empirical section reports outcomeMatch and INVALID_COMPARISON list", () => {
  const out = tmpDir();
  try {
    const result = generateRc1Report({ outDir: out });
    assert.ok(Array.isArray(result.empirical.INVALID_COMPARISON));
    assert.equal(typeof result.empirical.outcomeEquivalence.outcomeMatch, "number");
    assert.equal(
      typeof result.empirical.outcomeEquivalence.evaluated,
      "number"
    );
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("generateRc1Report accepts explicit inputs and is deterministic in structure", () => {
  const out = tmpDir();
  try {
    const validationSummary = {
      validationVersion: "1.0.0",
      causal: {
        byScenario: [{ id: "s1" }, { id: "s2" }],
        totals: {
          turns: 4,
          contextRebuilds: 2,
          fastPathCount: 2,
          fullRebuildCount: 2,
          partialRebuildCount: 0,
          totalReductionPct: 12.5
        }
      },
      snapshot: [
        { caseId: "c1", pass: true },
        { caseId: "c2", pass: true }
      ]
    };
    const realReport = {
      provider: "mock",
      model: "mock/dry-run",
      totals: {
        turns: 2,
        baselineInputTokens: 100,
        wamInputTokens: 40,
        contextRebuilds: 1,
        stateEquivalent: true,
        netInputSavings: 60
      },
      runs: [
        {
          pairId: "a#0",
          inputTokens: 40,
          totalTokens: 50,
          contextRebuilds: 1,
          baselineInputTokens: 100
        }
      ],
      perScenario: {
        a: {
          scenario: "a",
          turns: 2,
          baselineInputTokens: 100,
          wamInputTokens: 40,
          contextRebuilds: 1,
          netInputSavings: 60
        }
      },
      evaluations: [{ scenarioId: "a", trialId: 0, success: true, equivalent: true }],
      metrics: { EquivalenceRate: 100 }
    };

    generateRc1Report({ outDir: out, validationSummary, realReport });

    const metrics = JSON.parse(fs.readFileSync(path.join(out, "metrics.json"), "utf8"));
    assert.equal(metrics.internalDeterministic.snapshotPassed, 2);
    assert.equal(metrics.internalDeterministic.snapshotCases, 2);
    assert.equal(metrics.internalDeterministic.turns, 4);
    assert.equal(metrics.internalDeterministic.fastPathCount, 2);
    assert.equal(metrics.empiricalReal.inputTokens, 40);
    assert.equal(metrics.empiricalReal.baselineInputTokens, 100);
    assert.equal(metrics.empiricalReal.rebuilds, 1);
    assert.equal(metrics.empiricalReal.outcomeMatch, 1);
    assert.equal(metrics.empiricalReal.evaluated, 1);
    assert.equal(metrics.empiricalReal.invalidComparisons, 0);

    // Manifest must still be internally consistent after explicit inputs.
    const manifest = JSON.parse(
      fs.readFileSync(path.join(out, "manifest.json"), "utf8")
    );
    for (const a of manifest.artifacts) {
      assert.equal(a.sha256, sha256File(path.join(out, a.path)));
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("mismatched internal vs empirical signs raise INVALID_COMPARISON", () => {
  const out = tmpDir();
  try {
    generateRc1Report({
      outDir: out,
      validationSummary: {
        validationVersion: "1.0.0",
        causal: { byScenario: [], totals: { totalReductionPct: 30 } },
        snapshot: []
      },
      realReport: {
        provider: "mock",
        model: "m",
        totals: { netInputSavings: -50 },
        runs: [{ inputTokens: 1, totalTokens: 1, contextRebuilds: 0, baselineInputTokens: 1 }],
        perScenario: {},
        evaluations: [{ equivalent: true }]
      }
    });
    const comparison = JSON.parse(
      fs.readFileSync(path.join(out, "comparison.json"), "utf8")
    );
    const invalid = comparison.issues.filter((i) => i.code === "INVALID_COMPARISON");
    assert.ok(invalid.length >= 1, "expected an INVALID_COMPARISON issue");
    assert.match(invalid[0].detail, /No single net-savings number is claimed/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
