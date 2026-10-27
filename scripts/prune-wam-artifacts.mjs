#!/usr/bin/env node
/**
 * Prune one-use WAM task artifacts (benchmarks, test suites) from .wam/tasks.
 *
 * Default: dry-run. Pass --apply to move matching tasks/snapshots into
 * .wam/archive/tasks-test-<timestamp>/ and .wam/archive/snapshots-test-<timestamp>/.
 * Real user tasks are never touched.
 *
 * Usage:
 *   node scripts/prune-wam-artifacts.mjs [--apply] [--root <dir>]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = (() => {
  const i = process.argv.indexOf("--root");
  return i !== -1 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : process.cwd();
})();
const APPLY = process.argv.includes("--apply");
const WAM = path.join(ROOT, ".wam");
const TASKS = path.join(WAM, "tasks");
const SNAPSHOTS = path.join(WAM, "snapshots");

const TEST_PREFIXES = [
  "feature-partial-impl-",
  "bugfix-regression-still-fails-",
  "refactor-benchmarks-missing-",
  "lifecycle-",
  "fes-ev-",
  "audit-",
  "cg-",
  "cgv-",
  "g5-",
  "bq-",
  "ag-",
  "fc-",
  "rv-",
  "iso-",
  "rd-",
  "lfy-",
  "ver-",
  "dbg-",
  "meta-",
  "rs-",
  "sq-",
  "bench-",
  "dcu-",
  "srs-",
  "wam-inferred-",
  "task-router-",
  "task-crea-un-proyecto-de-node-js-llamado-ts-suma-",
  "task-acceptance-criteria-all-must-be-satisfied-",
  "ses-rd-",
  "fes-",
  "task-responde-solo-ok-sess-",
];

const TEST_PROMPTS = [
  /add support for deleting accounts/i,
  /implementar x/i,
  /implementar migraci/i,
  /test prompt/i,
  /todo verificado/i,
  /tarea completada/i,
  /declare done/i,
  /nuevo proyecto angular con shadcn/i,
  /olvida la autenticaci[oó]n, mejor agrega rate limiting/i,
  /read-only verification in .*do not modify/i,
  /g5/i,
];

const TEST_ID_RE = /-sess-test_\d+/i;

function isTestArtifact(id, lastAction) {
  if (TEST_ID_RE.test(id)) return true;
  if (TEST_PREFIXES.some((prefix) => id.startsWith(prefix))) return true;
  return TEST_PROMPTS.some((re) => re.test(String(lastAction || "")));
}

function main() {
  if (!fs.existsSync(TASKS)) {
    console.log(`No tasks directory at ${TASKS}`);
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const taskArchive = path.join(WAM, "archive", `tasks-test-${stamp}`);
  const snapArchive = path.join(WAM, "archive", `snapshots-test-${stamp}`);
  const moved = [];
  const kept = [];
  const skipped = [];
  let snapshotsMoved = 0;

  for (const id of fs.readdirSync(TASKS)) {
    const taskFile = path.join(TASKS, id, "task.json");
    let lastAction = "";
    try {
      lastAction = JSON.parse(fs.readFileSync(taskFile, "utf8")).lastAction || "";
    } catch {}
    if (!isTestArtifact(id, lastAction)) {
      kept.push(id);
      continue;
    }
    if (APPLY) {
      try {
        fs.mkdirSync(taskArchive, { recursive: true });
        fs.renameSync(path.join(TASKS, id), path.join(taskArchive, id));
        moved.push(id);
      } catch (err) {
        skipped.push({ id, reason: err.code || err.message });
      }
      const snap = path.join(SNAPSHOTS, `${id}.json`);
      if (fs.existsSync(snap)) {
        try {
          fs.mkdirSync(snapArchive, { recursive: true });
          fs.renameSync(snap, path.join(snapArchive, `${id}.json`));
          snapshotsMoved++;
        } catch {}
      }
    } else {
      moved.push(id);
    }
  }

  if (APPLY && moved.length) {
    fs.mkdirSync(path.dirname(taskArchive), { recursive: true });
    fs.writeFileSync(
      path.join(taskArchive, "manifest.json"),
      JSON.stringify({ createdAt: new Date().toISOString(), moved }, null, 2)
    );
  }

  console.log(JSON.stringify({ apply: APPLY, moved: moved.length, kept: kept.length, skipped: skipped.length, snapshotsMoved, taskArchive, snapArchive, skippedSample: skipped.slice(0, 5) }, null, 2));
}

main();
