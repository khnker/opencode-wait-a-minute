/**
 * CLI end-to-end tests for the prompt-eval correctness gate.
 *
 * Drives the REAL CLIs (`scripts/prompts-eval.mjs`, `scripts/prompts-compare.mjs`)
 * via child processes, writing runs into a temp outDir so the repo
 * `benchmarks/quality/prompt-eval/runs/` directory is never polluted.
 *
 * The deliberate critical regression between the `baseline` and `candidate`
 * labels comes from the recorded fixtures under
 * `benchmarks/quality/prompt-eval/outputs/` (one fixture set per label), so the
 * test is fully offline and deterministic.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import os from "node:os";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRunsDir = path.join(repoRoot, "benchmarks/quality/prompt-eval/runs");
const CLI_TIMEOUT_MS = 60_000;

function runCli(script, args) {
  return execFileSync(process.execPath, [path.join(repoRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: CLI_TIMEOUT_MS,
  });
}

/** Runs the eval CLI over the `core` suite and returns the reported run id. */
function evalCoreSuite(outDir, label) {
  const stdout = runCli("prompts-eval.mjs", ["--suite", "core", "--label", label, "--outDir", outDir]);
  const match = stdout.match(/Run completed: (\S+)/);
  assert.ok(match, `eval CLI must report its run id on stdout, got: ${JSON.stringify(stdout)}`);
  return match[1];
}

/** Runs the compare CLI and returns the parsed comparison result. */
function compareRunsViaCli(outDir, baselineId, candidateId) {
  const stdout = runCli("prompts-compare.mjs", [
    "--baseline", baselineId,
    "--candidate", candidateId,
    "--outDir", outDir,
  ]);
  return JSON.parse(stdout);
}

function snapshotRepoRuns() {
  return fs.existsSync(repoRunsDir) ? fs.readdirSync(repoRunsDir).sort() : [];
}

/** Clones a run produced by the CLI into `<newId>/run.json` with blanked
 * per-scenario details and metrics — what an interrupted/partial run looks like. */
function cloneRunWithEmptyDetails(outDir, sourceId, newId) {
  const source = JSON.parse(fs.readFileSync(path.join(outDir, sourceId, "run.json"), "utf8"));
  for (const record of source.labels) {
    record.details = [];
    record.metrics = {};
  }
  const targetDir = path.join(outDir, newId);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "run.json"), `${JSON.stringify(source, null, 2)}\n`, "utf8");
}

describe("prompt-eval CLI e2e", () => {
  it("PQ-CORR-10: CLI end-to-end detects a critical regression", () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-prompt-eval-"));
    try {
      const runsBefore = snapshotRepoRuns();

      // Produce baseline + candidate runs over the core suite with the REAL CLI.
      const baselineId = evalCoreSuite(outDir, "baseline");
      const candidateId = evalCoreSuite(outDir, "candidate");
      assert.match(baselineId, /^baseline--/);
      assert.match(candidateId, /^candidate--/);

      // Compare with the REAL CLI: the deliberate critical regression baked
      // into the candidate fixtures must be detected.
      const result = compareRunsViaCli(outDir, baselineId, candidateId);
      assert.strictEqual(result.decision.decision, "REGRESSION");
      assert.match(
        result.decision.evidence,
        /critical regressions detected in: .+ critical criterion/,
        `evidence must name the critical scenario/criterion, got: ${JSON.stringify(result.decision.evidence)}`,
      );

      // The repo runs/ directory must stay untouched (temp outDir only).
      assert.deepEqual(snapshotRepoRuns(), runsBefore, "repo runs/ dir must not be polluted");
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("PQ-CORR-11: interrupted/empty candidate run is never IMPROVED", () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-prompt-eval-"));
    try {
      const runsBefore = snapshotRepoRuns();

      const baselineId = evalCoreSuite(outDir, "baseline");
      const candidateId = evalCoreSuite(outDir, "candidate");
      // Simulate an interrupted candidate run: same suite/config/prompts, but
      // no per-scenario details and no metrics were written.
      const emptyId = `${candidateId}--empty`;
      cloneRunWithEmptyDetails(outDir, candidateId, emptyId);

      const result = compareRunsViaCli(outDir, baselineId, emptyId);
      assert.notStrictEqual(
        result.decision.decision,
        "IMPROVED",
        `an interrupted/empty candidate run must never yield IMPROVED, got: ${JSON.stringify(result.decision)}`,
      );

      assert.deepEqual(snapshotRepoRuns(), runsBefore, "repo runs/ dir must not be polluted");
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
