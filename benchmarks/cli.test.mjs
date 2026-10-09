import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runSuite, parseArgs, SUITES } from "./cli.mjs";

const ENVELOPE = ["manifest.json", "raw.json", "metrics.json", "report.md"];

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("runSuite('deterministic') writes the four envelope files", async () => {
  const out = tmpDir("wam-cli-det-");
  try {
    const result = await runSuite("deterministic", { outDir: out });
    const dir = path.join(out, "deterministic");
    for (const name of ENVELOPE) {
      const p = path.join(dir, name);
      assert.ok(fs.existsSync(p), `missing envelope file ${name}`);
      assert.ok(fs.statSync(p).size > 0, `empty envelope file ${name}`);
    }
    assert.equal(result.suite, "deterministic");
    assert.equal(result.outDir, dir);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("runSuite('quality') writes the four envelope files", async () => {
  const out = tmpDir("wam-cli-qual-");
  try {
    const result = await runSuite("quality", { outDir: out });
    const dir = path.join(out, "quality");
    for (const name of ENVELOPE) {
      const p = path.join(dir, name);
      assert.ok(fs.existsSync(p), `missing envelope file ${name}`);
      assert.ok(fs.statSync(p).size > 0, `empty envelope file ${name}`);
    }
    assert.equal(result.suite, "quality");
    assert.equal(result.outDir, dir);
    const metrics = JSON.parse(fs.readFileSync(path.join(dir, "metrics.json"), "utf8"));
    assert.equal(metrics.offline, true);
    const report = fs.readFileSync(path.join(dir, "report.md"), "utf8");
    assert.match(report, /QUALITY BENCHMARK REPORT/);
    assert.match(report, /Average Fact Coverage/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("envelope manifest hashes the other three artifacts", async () => {
  const out = tmpDir("wam-cli-det-man-");
  try {
    await runSuite("deterministic", { outDir: out });
    const dir = path.join(out, "deterministic");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, "manifest.json"), "utf8")
    );
    assert.equal(manifest.schema, "rc1-cli-envelope@1");
    assert.equal(manifest.suite, "deterministic");
    assert.equal(manifest.artifacts.length, 3);
    for (const a of manifest.artifacts) {
      assert.ok(fs.existsSync(path.join(dir, a.path)), `missing ${a.path}`);
      assert.match(a.sha256, /^[a-f0-9]{64}$/);
    }
    // manifest must not hash itself
    assert.equal(
      manifest.artifacts.some((a) => a.path === "manifest.json"),
      false
    );
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("envelope json files are valid JSON", async () => {
  const out = tmpDir("wam-cli-det-json-");
  try {
    await runSuite("deterministic", { outDir: out });
    const dir = path.join(out, "deterministic");
    for (const name of ["manifest.json", "raw.json", "metrics.json"]) {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      assert.equal(typeof parsed, "object");
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("unknown suite throws", async () => {
  const out = tmpDir("wam-cli-bad-");
  try {
    await assert.rejects(
      () => runSuite("does-not-exist", { outDir: out }),
      /Unknown suite/
    );
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("parseArgs defaults to deterministic and supports --suite/--out", () => {
  assert.equal(parseArgs(["node", "cli.mjs"]).suite, "deterministic");
  assert.equal(parseArgs(["node", "cli.mjs", "--suite=validation"]).suite, "validation");
  assert.equal(parseArgs(["node", "cli.mjs", "--suite=all"]).suite, "all");
  assert.ok(path.isAbsolute(parseArgs(["node", "cli.mjs", "--out=/tmp/x"]).out));
});

test("parseArgs rejects an unknown suite", () => {
  assert.throws(
    () => parseArgs(["node", "cli.mjs", "--suite=bogus"]),
    /Unknown suite/
  );
});

test("SUITES lists the four runnable suites", () => {
  assert.deepEqual([...SUITES].sort(), ["deterministic", "quality", "real", "validation"]);
});

test("catalogue legacy benchmark files exist at their recorded locations", () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  // The legacy catalogue must exist and be valid JSON.
  const index = JSON.parse(
    fs.readFileSync(path.join(root, "benchmarks", "legacy", "index.json"), "utf8")
  );
  for (const b of index.benchmarks) {
    const loc = (b.location || "").replace(/\/$/, "");
    const rel =
      !loc || loc === "repository root" || b.file.startsWith(loc + "/")
        ? b.file
        : path.join(loc, b.file);
    assert.ok(fs.existsSync(path.join(root, rel)), `catalogue file ${rel} must exist`);
  }
  assert.ok(Array.isArray(index.benchmarks));
  assert.ok(index.benchmarks.length >= 3);
  for (const b of index.benchmarks) {
    assert.ok(b.disposition, `missing disposition for ${b.file}`);
    assert.ok(b.rationale, `missing rationale for ${b.file}`);
  }
});
