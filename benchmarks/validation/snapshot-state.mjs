/**
 * Snapshot-state validation — deterministic matrix over context snapshots.
 *
 * Seeds an isolated project root per case, creates a baseline snapshot, applies a
 * single mutation, then asserts the classification (VALID | STALE | INVALID),
 * the changed signals, and the resulting rebuild scope.
 *
 * Every case is fully isolated: own root, own snapshot, own collector.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createSnapshot, checkContinuation, rebuildScope } from "../../context-snapshot.js";
import { createCollector } from "../instrumentation/collector.mjs";

const TASK_ID = "snapshot-matrix";
const GIT_SHA = "aaaa1111bbbb2222cccc3333";
const GIT_SHA_NEXT = "dddd4444eeee5555ffff6666";

const BASELINE_TASK_STATE = Object.freeze({
  contract: { status: "APPROVED", rigor: "NORMAL" },
  requirements: [{ id: "R1", status: "MET" }],
  phase: "IMPLEMENTING",
  approvedStrategy: { strategy: "baseline", status: "ACTIVE", scope: "project" },
});

const NO_REBUILD = Object.freeze({ rebuildN1: false, rebuildN2: false, rebuildN3: false });
const PROJECT_REBUILD = Object.freeze({ rebuildN1: true, rebuildN2: false, rebuildN3: true });
const FULL_REBUILD = Object.freeze({ rebuildN1: true, rebuildN2: true, rebuildN3: true });

function snapshotFile(root) {
  return path.join(root, ".wam", "snapshots", `${TASK_ID}.json`);
}

function readSnapshot(root) {
  return JSON.parse(fs.readFileSync(snapshotFile(root), "utf-8"));
}

function writeSnapshot(root, snapshot) {
  fs.writeFileSync(snapshotFile(root), `${JSON.stringify(snapshot, null, 2)}\n`);
}

/** Minimal project root: git ref + a single relevant file. */
function seedRoot(root) {
  fs.mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(path.join(root, ".git", "refs", "heads", "main"), `${GIT_SHA}\n`);
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "snapshot-fixture", version: "0.0.0" }, null, 2)}\n`
  );
}

const seedPackageJson = (root, patch) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
  writeFileJson(path.join(root, "package.json"), { ...manifest, ...patch });
};

function writeFileJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * @typedef {Object} SnapshotMatrixCase
 * @property {string} id
 * @property {string} description
 * @property {boolean} mutates  true when the case must not be classified VALID
 * @property {(root: string, ctx: { taskState: Object }) => void} mutate
 * @property {Object} [taskState]  current task state handed to checkContinuation
 * @property {{ status: string, changedSignals: string[], rebuild: Object }} expected
 */

/** @type {SnapshotMatrixCase[]} */
export const SNAPSHOT_MATRIX = [
  {
    id: "no-mutation",
    description: "Snapshot matches git, project context and task state → fast-path VALID.",
    mutates: false,
    mutate: () => {},
    expected: { status: "VALID", changedSignals: [], rebuild: NO_REBUILD },
  },
  {
    id: "task-mutation",
    description: "Task state phase changed → INVALID, full rebuild.",
    mutates: true,
    taskState: { ...BASELINE_TASK_STATE, phase: "REVIEWING" },
    mutate: () => {
      // The mutation lives in the task state handed to checkContinuation.
    },
    expected: { status: "INVALID", changedSignals: ["task-state"], rebuild: FULL_REBUILD },
  },
  {
    id: "context-mutation",
    description: "Relevant file content changed → STALE, project-level rebuild.",
    mutates: true,
    mutate: (root) => seedPackageJson(root, { dependencies: { changed: "1.0.0" } }),
    expected: { status: "STALE", changedSignals: ["relevant-files"], rebuild: PROJECT_REBUILD },
  },
  {
    id: "file-mutation",
    description: "New relevant file appears → STALE, project-level rebuild.",
    mutates: true,
    mutate: (root) => {
      writeFileJson(path.join(root, "tsconfig.json"), { compilerOptions: { strict: true } });
    },
    expected: { status: "STALE", changedSignals: ["relevant-files"], rebuild: PROJECT_REBUILD },
  },
  {
    id: "git-mutation",
    description: "Git ref moved → STALE, project-level rebuild.",
    mutates: true,
    mutate: (root) => {
      fs.writeFileSync(path.join(root, ".git", "refs", "heads", "main"), `${GIT_SHA_NEXT}\n`);
    },
    expected: { status: "STALE", changedSignals: ["git-revision"], rebuild: PROJECT_REBUILD },
  },
  {
    id: "hash-mutation",
    description: "Stored taskStateHash tampered → INVALID, full rebuild.",
    mutates: true,
    mutate: (root) => {
      const snapshot = readSnapshot(root);
      writeSnapshot(root, { ...snapshot, taskStateHash: "deadbeefdeadbeef" });
    },
    expected: { status: "INVALID", changedSignals: ["task-state"], rebuild: FULL_REBUILD },
  },
  {
    id: "stored-relevant-hash",
    description: "Stored relevantFilesHash tampered → STALE, project-level rebuild.",
    mutates: true,
    mutate: (root) => {
      const snapshot = readSnapshot(root);
      writeSnapshot(root, { ...snapshot, relevantFilesHash: "deadbeefdeadbeef" });
    },
    expected: { status: "STALE", changedSignals: ["relevant-files"], rebuild: PROJECT_REBUILD },
  },
  {
    id: "snapshot-missing",
    description: "Snapshot deleted → STALE no-snapshot, full rebuild.",
    mutates: true,
    mutate: (root) => {
      fs.rmSync(snapshotFile(root), { force: true });
    },
    expected: { status: "STALE", changedSignals: ["no-snapshot"], rebuild: FULL_REBUILD },
  },
  {
    id: "snapshot-corrupt",
    description: "Snapshot is not valid JSON → safe fallback, full rebuild.",
    mutates: true,
    mutate: (root) => {
      fs.writeFileSync(snapshotFile(root), "{ this is not json");
    },
    expected: { status: "STALE", changedSignals: ["no-snapshot"], rebuild: FULL_REBUILD },
  },
  {
    id: "snapshot-schema-incompatible",
    description: "Snapshot parses but lacks hash fields → INVALID, full rebuild.",
    mutates: true,
    mutate: (root) => {
      writeSnapshot(root, { taskId: TASK_ID, createdAt: 0 });
    },
    expected: {
      status: "INVALID",
      changedSignals: ["relevant-files", "task-state"],
      rebuild: FULL_REBUILD,
    },
  },
];

function sameSignalSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((signal, index) => signal === right[index]);
}

function sameRebuildScope(a = {}, b = {}) {
  return (
    Boolean(a.rebuildN1) === Boolean(b.rebuildN1) &&
    Boolean(a.rebuildN2) === Boolean(b.rebuildN2) &&
    Boolean(a.rebuildN3) === Boolean(b.rebuildN3)
  );
}

function isCasePass(expected, actual) {
  return (
    expected.status === actual.status &&
    sameSignalSet(expected.changedSignals, actual.changedSignals) &&
    sameRebuildScope(expected.rebuild, actual.rebuild)
  );
}

/**
 * Run the whole matrix in isolated temp roots.
 *
 * @param {{ baseDir?: string }} [options]
 * @returns {Promise<Array<Object>>} one result per matrix case
 */
export async function runSnapshotStateValidation({ baseDir } = {}) {
  const ownsBase = !baseDir;
  const base = baseDir || fs.mkdtempSync(path.join(os.tmpdir(), "wam-snapshot-state-"));
  const results = [];

  try {
    for (const testCase of SNAPSHOT_MATRIX) {
      const root = path.join(base, testCase.id);
      fs.rmSync(root, { recursive: true, force: true });
      seedRoot(root);
      createSnapshot(TASK_ID, BASELINE_TASK_STATE, root);

      const currentTaskState = testCase.taskState || BASELINE_TASK_STATE;
      testCase.mutate(root, { taskState: currentTaskState });

      const collector = createCollector();
      const check = checkContinuation(TASK_ID, currentTaskState, root, collector);

      // Fast path: a VALID snapshot performs no reconstruction at all.
      const rebuildInvoked = check.status !== "VALID";
      const rebuild = rebuildInvoked ? rebuildScope(check.changedSignals, collector) : { ...NO_REBUILD };

      const expected = testCase.expected;
      const actual = {
        status: check.status,
        changedSignals: check.changedSignals,
        rebuild,
      };

      results.push({
        caseId: testCase.id,
        description: testCase.description,
        mutates: testCase.mutates,
        expected,
        actual,
        rebuildInvoked,
        pass: isCasePass(expected, actual),
        counters: collector.snapshot(),
      });
    }
  } finally {
    if (ownsBase) fs.rmSync(base, { recursive: true, force: true });
  }

  return results;
}

/**
 * Guard against a mutated/missing/corrupt context being accepted as VALID.
 *
 * @param {Array<{ caseId: string, mutates?: boolean, actual: { status: string } }>} results
 * @returns {true} when no mutated case was classified VALID
 * @throws {Error} on the first false-valid case
 */
export function assertNoFalseValid(results = []) {
  const falseValid = results.filter((r) => r.mutates && r.actual.status === "VALID");
  if (falseValid.length > 0) {
    const names = falseValid.map((r) => r.caseId).join(", ");
    throw new Error(`false-valid snapshot classification: ${names}`);
  }
  return true;
}
