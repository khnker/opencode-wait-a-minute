#!/usr/bin/env node
/**
 * Run the full suite in a throwaway copy of the repo.
 *
 * The suite writes `.wam` state under the working root, so running it while a
 * live WAM session uses the same project makes both processes contend for
 * `active-task` and task state. This wrapper copies the tree (without `.git`,
 * `.wam`, `node_modules`, `dist`), links `node_modules`, runs the normal
 * runner there, and removes the sandbox afterwards.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "wam-suite-"));

const skip = new Set([".wam", "node_modules", "dist", "upstream", "test_tmp"]);
fs.cpSync(repoRoot, sandbox, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(repoRoot, src);
    return rel === "" || !skip.has(rel.split(path.sep)[0]);
  },
});
fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(sandbox, "node_modules"), "dir");

try {
  const result = spawnSync(process.execPath, [path.join(sandbox, "scripts", "run-tests.mjs"), ...process.argv.slice(2)], {
    cwd: sandbox,
    stdio: "inherit",
    env: { ...process.env, WAM_TEST_SANDBOX: sandbox },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
