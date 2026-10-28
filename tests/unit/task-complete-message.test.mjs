import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import pluginDefault from "../../index.js";
import { getTaskState } from "../../src/skills/engine.js";

test("emits the final completion message once when the contract is verified", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-complete-msg-"));
  const hooks = await pluginDefault({ directory: root, client: {}, project: {}, $: {} });
  const taskId = "complete-msg-task";

  await hooks["chat.message"](
    {
      sessionID: "s1",
      messageID: "m1",
      message: { parts: [{ type: "text", text: "implementar un endpoint healthcheck con tests" }] },
      taskId,
    },
    { message: {}, parts: [] }
  );

  const approved = pluginDefault.approveContract(taskId, root);
  assert.equal(approved.ok, true);

  const state = getTaskState(taskId, root);
  for (const req of state.requirements) {
    const done = await pluginDefault.markRequirement(taskId, req.id, "done", `evidencia ${req.id}`, root);
    assert.equal(done.ok, true);
    const verified = await pluginDefault.markRequirement(taskId, req.id, "verified", `evidencia ${req.id}`, root);
    assert.equal(verified.ok, true);
  }

  const out = { message: { id: "m2" }, parts: [] };
  await hooks["chat.message"](
    {
      sessionID: "s1",
      messageID: "m2",
      message: { parts: [{ type: "text", text: "listo, terminado" }] },
      taskId,
    },
    out
  );

  const text = out.parts.map((p) => p.text || "").join("\n");
  assert.match(text, /Tarea completada/);
  assert.match(text, /Requisitos verificados:/);
  assert.match(text, /Evidencia:/);

  const second = { message: { id: "m3" }, parts: [] };
  await hooks["chat.message"](
    {
      sessionID: "s1",
      messageID: "m3",
      message: { parts: [{ type: "text", text: "listo, terminado" }] },
      taskId,
    },
    second
  );
  const secondText = second.parts.map((p) => p.text || "").join("\n");
  assert.ok(!secondText.includes("Tarea completada"), "completion message must be emitted once");

  fs.rmSync(root, { recursive: true, force: true });
});
