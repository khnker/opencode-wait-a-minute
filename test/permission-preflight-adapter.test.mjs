/**
 * Adapter test: permission preflight gates main-session delegation and answers
 * opencode's permission.ask hook from the granted plan.
 *
 * Run: node --test --test-force-exit test/permission-preflight-adapter.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import pluginDefault from "../index.js";

function setupTmp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-permission-preflight-"));
  const taskId = "t1";
  const taskDir = path.join(tmp, ".wam", "tasks", taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(
    path.join(taskDir, "task.json"),
    JSON.stringify({
      phase: "IMPLEMENTING",
      contract: { status: "APPROVED", unknowns: [], assumptions: [] },
      requirements: [{ id: "req-1", title: "run tests", status: "pending", evidence: [] }],
      permissionPreflight: {
        required: [{ type: "edit", reason: "x" }],
        status: "pending",
        granted: [],
        approvedAt: null,
      },
    }),
  );
  fs.writeFileSync(
    path.join(tmp, ".wam", "active-task"),
    JSON.stringify({ id: taskId, ts: Date.now(), sessionId: "sess-1", projectRoot: tmp }),
  );
  return { tmp, taskId };
}

function writePlan(tmp, taskId, plan) {
  const file = path.join(tmp, ".wam", "tasks", taskId, "task.json");
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  state.permissionPreflight = plan;
  fs.writeFileSync(file, JSON.stringify(state));
}

test("pending preflight blocks task delegation and granted types are allowed", async (t) => {
  const { tmp, taskId } = setupTmp();
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const hooks = await pluginDefault({ directory: tmp, client: {}, project: {}, $: {} });

  assert.equal(typeof hooks["permission.ask"], "function");

  await assert.rejects(
    () => hooks["tool.execute.before"]({ tool: "task", sessionID: "sess-1" }, { args: { description: "delegate" } }),
    /PERMISSION PREFLIGHT/,
  );

  writePlan(tmp, taskId, { required: [{ type: "edit", reason: "x" }], status: "granted", granted: ["edit"], approvedAt: Date.now() });

  const out = { status: "ask" };
  await hooks["permission.ask"]({ type: "edit", sessionID: "sess-1", pattern: "*" }, out);
  assert.equal(out.status, "allow");

  const other = { status: "ask" };
  await hooks["permission.ask"]({ type: "bash", sessionID: "sess-1", pattern: "*" }, other);
  assert.equal(other.status, "ask");
});

test("subagent permission requests inherit the parent's granted plan", async (t) => {
  const { tmp, taskId } = setupTmp();
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  writePlan(tmp, taskId, { required: [{ type: "edit", reason: "x" }], status: "granted", granted: ["edit"], approvedAt: Date.now() });

  const client = {
    session: {
      get: async () => ({ location: { directory: tmp }, parentID: "sess-1" }),
    },
  };
  const hooks = await pluginDefault({ directory: tmp, client, project: {}, $: {} });

  const out = { status: "ask" };
  await hooks["permission.ask"]({ type: "edit", sessionID: "child-1", pattern: "*" }, out);
  assert.equal(out.status, "allow");
});
