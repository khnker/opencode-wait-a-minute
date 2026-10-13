import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPTS, "..");
const CAPTURE = path.join(SCRIPTS, "prompts-capture-gold.mjs");
const CANONICAL_GOLD = path.join(
  ROOT,
  "benchmarks",
  "quality",
  "prompt-eval",
  "gold",
  "v1-provisional",
);

const tmps = [];
after(() => {
  for (const dir of tmps) fs.rmSync(dir, { recursive: true, force: true });
});

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-gold-capture-"));
  tmps.push(dir);
  return dir;
}

function runCapture(args) {
  return spawnSync(process.execPath, [CAPTURE, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

/** Byte-level fingerprint of a gold fixture: meta.json + raw/*.json. */
function hashFixture(dir) {
  const hashes = {};
  const metaPath = path.join(dir, "meta.json");
  if (fs.existsSync(metaPath)) {
    hashes["meta.json"] = createHash("sha256").update(fs.readFileSync(metaPath)).digest("hex");
  }
  const rawDir = path.join(dir, "raw");
  if (fs.existsSync(rawDir)) {
    for (const name of fs.readdirSync(rawDir).sort()) {
      if (!name.endsWith(".json")) continue;
      const abs = path.join(rawDir, name);
      hashes[`raw/${name}`] = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
    }
  }
  return hashes;
}

function makeFrozenFixture(dir) {
  fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    `${JSON.stringify({ schema: "test", version: "v1-provisional", sentinel: true }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(dir, "raw", "verify.json"),
    `${JSON.stringify({ suite: "verify", sentinel: true }, null, 2)}\n`,
  );
}

test("--help prints usage, exits 0, and writes nothing", () => {
  const out = tmpDir();
  const res = runCapture(["--help", "--out", out]);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /^Usage: node scripts\/prompts-capture-gold\.mjs/);
  assert.deepEqual(fs.readdirSync(out), [], "--help must not write any file");
});

test("capture onto the canonical frozen gold dir (mock fallback, no --force) is refused and leaves bytes identical", () => {
  const before = hashFixture(CANONICAL_GOLD);
  assert.ok(Object.keys(before).length > 0, "canonical gold fixture must exist");

  const res = runCapture([]);
  assert.notEqual(res.status, 0, "must abort non-zero without --force");
  assert.match(res.stderr, /Refusing to overwrite/);
  assert.deepEqual(hashFixture(CANONICAL_GOLD), before, "gold fixture must stay byte-identical");
});

test("--force is the only way to overwrite a frozen fixture", () => {
  const target = tmpDir();
  makeFrozenFixture(target);
  const before = hashFixture(target);

  const refused = runCapture(["--out", target, "--dry-run"]);
  assert.notEqual(refused.status, 0, "must abort non-zero without --force");
  assert.match(refused.stderr, /Refusing to overwrite/);
  assert.deepEqual(hashFixture(target), before, "refused run must not touch the fixture");

  const forced = runCapture(["--out", target, "--dry-run", "--force", "--suite", "verify"]);
  assert.equal(forced.status, 0, `stderr: ${forced.stderr}`);
  assert.notDeepEqual(hashFixture(target), before, "--force must actually overwrite");
});

test("calibrate --help prints usage and exits 0", () => {
  const res = spawnSync(
    process.execPath,
    [path.join(SCRIPTS, "prompts-calibrate.mjs"), "--help"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /^Usage: node scripts\/prompts-calibrate\.mjs/);
});
