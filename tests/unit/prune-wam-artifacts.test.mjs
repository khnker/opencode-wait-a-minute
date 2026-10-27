import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SCRIPT = path.resolve("scripts/prune-wam-artifacts.mjs");

function writeTask(root, id, lastAction) {
  const dir = path.join(root, ".wam", "tasks", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "task.json"), JSON.stringify({ lastAction }));
}

test("prune-wam-artifacts archives test tasks and keeps real ones", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-prune-"));
  writeTask(root, "cg-ac5-123", "Add support for deleting accounts");
  writeTask(root, "task-real-user", "implementa la feature de verdad");
  fs.mkdirSync(path.join(root, ".wam", "snapshots"), { recursive: true });
  fs.writeFileSync(path.join(root, ".wam", "snapshots", "cg-ac5-123.json"), "{}");

  execFileSync(process.execPath, [SCRIPT, "--root", root, "--apply"], { stdio: "ignore" });

  assert.ok(!fs.existsSync(path.join(root, ".wam", "tasks", "cg-ac5-123")));
  assert.ok(fs.existsSync(path.join(root, ".wam", "tasks", "task-real-user")));
  assert.ok(!fs.existsSync(path.join(root, ".wam", "snapshots", "cg-ac5-123.json")));

  const archive = path.join(root, ".wam", "archive");
  const dirs = fs.readdirSync(archive).filter((d) => d.startsWith("tasks-test-"));
  assert.equal(dirs.length, 1);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(archive, dirs[0], "manifest.json"), "utf8")
  );
  assert.deepEqual(manifest.moved, ["cg-ac5-123"]);
  fs.rmSync(root, { recursive: true, force: true });
});
