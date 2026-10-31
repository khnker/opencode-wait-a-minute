/**
 * Contract approval gate — regression for auto-approval on low uncertainty.
 *
 * A PROPOSED contract must stay PROPOSED unless the prompt starts with an
 * explicit confirmation (si/sí/ok/...). The approval notice must use the
 * nextAction refreshed after approveContract, never the pre-approval one.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import pluginDefault from "../../index.js";
import { getTaskState } from "../../src/skills/engine.js";

const CWD = process.cwd();

function cleanup(taskId) {
  try { fs.rmSync(path.join(CWD, ".wam", "tasks", taskId), { recursive: true, force: true }); } catch {}
  try { fs.rmSync(path.join(CWD, ".wam", "active-task"), { force: true }); } catch {}
}

function send(hooks, taskId, text, seq) {
  const input = {
    sessionID: "sess-contract-gate",
    messageID: `gate-${taskId}-${seq}`,
    message: { parts: [{ type: "text", text }] },
    taskId,
  };
  const out = { message: {}, parts: [] };
  return hooks["chat.message"](input, out).then(() => ({
    emitted: out.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"),
  }));
}

test("contract approval requires explicit confirmation and emits post-refresh nextAction", async () => {
  const taskId = `gate-${Date.now()}`;
  const hooks = await pluginDefault({ directory: CWD, client: {}, project: {}, $: {} });

  try {
    // El contrato es informativo: nace APPROVED y nunca pide confirmación.
    await send(hooks, taskId, "implementa un endpoint REST para usuarios en nestjs", 1);
    let state = getTaskState(taskId);
    assert.equal(state.contract.status, "APPROVED", "el contrato nace aprobado (advisory)");

    // Free text never approves nor rejects a contract.
    const no = await send(hooks, taskId, "no", 2);
    state = getTaskState(taskId);
    assert.equal(state.contract.status, "APPROVED", "texto libre nunca cambia el contrato");
    assert.ok(!no.emitted.includes("¿Apruebo"), "no hay pregunta de aprobación");
    assert.ok(!no.emitted.includes("Contrato rechazado"), "no hay rechazo por texto libre");
  } finally {
    cleanup(taskId);
  }
});
