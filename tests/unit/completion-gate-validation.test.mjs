/**
 * Completion gate — inyección de la validación al LLM.
 *
 * Escenario: el LLM declara DONE pero el contrato todavía tiene requisitos
 * pendientes. WAM debe:
 *   1. enviar la advertencia/validación al LLM (parte propia) con lo que
 *      falta y la acción solicitada por el usuario ("Listo, continúa");
 *   2. entregarla en todas las formas de output que usa OpenCode
 *      ({ parts } y { message: { parts } }) — antes se perdía en silencio;
 *   3. disparar el gate con las frases de completitud reales ("terminado,
 *      done", "todo listo, done") que antes lo evadían.
 *
 * Ejecutar: node --test tests/unit/completion-gate-validation.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pluginDefault from "../../index.js";
import { getTaskState } from "../../src/skills/engine.js";
import { buildCompletionValidation, isCompletionIntent } from "../../src/integration/orchestration.js";

const CWD = process.cwd();

async function runHook(prompt, taskId, sessionID, providedOutput) {
  const hooks = await pluginDefault({ directory: CWD, client: {}, project: {}, $: {} });
  const output = providedOutput || { message: {}, parts: [] };
  await hooks["chat.message"]({ sessionID, message: { parts: [{ type: "text", text: prompt }] }, taskId }, output);
  return output;
}

function cleanup(taskId) {
  try { fs.rmSync(path.join(CWD, ".wam", "tasks", taskId), { recursive: true, force: true }); } catch {}
}

function findPart(parts, needle) {
  return (parts || []).find(
    (p) => p?.type === "text" && typeof p.text === "string" && p.text.includes(needle),
  );
}

test("unit: buildCompletionValidation declara la acción solicitada y lo que falta", () => {
  const validation = buildCompletionValidation(
    { blocked: true, pending: ["req-2 — Agregar tests para el cambio"] },
    { nextAction: "Implementar req-2" },
  );
  assert.equal(validation.requestedAction, "Listo, continúa");
  assert.match(validation.text, /VALIDACIÓN/);
  assert.match(validation.text, /req-2 — Agregar tests para el cambio/);
  assert.match(validation.text, /Acción solicitada por el usuario: "Listo, continúa"/);
  assert.match(validation.text, /No declares DONE/);
  assert.match(validation.text, /Continuar con: Implementar req-2/);
});

test("unit: el gate dispara con las frases de completitud que antes lo evadían", () => {
  for (const claim of [
    "terminado, done",
    "todo listo, done",
    "todo verificado, tarea completa done",
    "ya está, todo ok",
  ]) {
    assert.equal(isCompletionIntent(claim), true, `debe clasificar como claim: ${claim}`);
  }
  for (const notClaim of [
    "this is a complete disaster",
    "the unfinished file",
    "could you complete the form?",
    "when will it be done?",
  ]) {
    assert.equal(isCompletionIntent(notClaim), false, `no debe clasificar: ${notClaim}`);
  }
});

test("e2e: claim de completitud con requisitos pendientes → validación inyectada al LLM", async () => {
  const taskId = `cgv-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, "cgv-a");
  pluginDefault.approveContract(taskId);
  const pendingReq = getTaskState(taskId).requirements[0];

  const out = await runHook("Listo, ya está todo hecho", taskId, "cgv-b");
  cleanup(taskId);

  const validation = findPart(out.parts, "VALIDACIÓN");
  assert.ok(validation, "la validación se inyecta como parte propia");
  assert.ok(validation.text.includes(pendingReq.id), "identifica el requisito pendiente");
  assert.match(validation.text, /Listo, continúa/);
  assert.match(validation.text, /No declares DONE/);
  assert.ok(findPart(out.parts, "COMPLETION GATE"), "el aviso de gate para el usuario sigue presente");
});

test("e2e: claim de completitud en español ('terminado, done') también inyecta la validación", async () => {
  const taskId = `cgv-es-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, "cgv-c");
  pluginDefault.approveContract(taskId);

  const out = await runHook("terminado, done", taskId, "cgv-d");
  cleanup(taskId);

  const validation = findPart(out.parts, "VALIDACIÓN");
  assert.ok(validation, "la validación se inyecta también para claims en español");
  assert.match(validation.text, /Listo, continúa/);
});

test("e2e: la validación también llega cuando el output sólo tiene message.parts", async () => {
  const taskId = `cgv-msg-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, "cgv-e");
  pluginDefault.approveContract(taskId);

  // Shape de OpenCode sin output.parts: la inyección no debe perderse.
  const out = { message: { parts: [] } };
  await runHook("Listo, ya está todo hecho", taskId, "cgv-f", out);
  cleanup(taskId);

  const validation = findPart(out.message.parts, "VALIDACIÓN");
  assert.ok(validation, "la validación llega al LLM en message.parts");
  assert.match(validation.text, /Listo, continúa/);
});

test("unit: las partes inyectadas llevan sessionID y messageID (schema 1.19)", async () => {
  const { injectWamParts } = await import("../../src/integration/part-provenance.js");
  const out = { parts: [] };
  injectWamParts(out, [{ type: "text", text: "validación" }], {
    sessionID: "ses_test",
    messageID: "msg_test",
    phase: "gate-validation",
  });
  assert.equal(out.parts[0].sessionID, "ses_test");
  assert.equal(out.parts[0].messageID, "msg_test");
  assert.equal(out.parts[0].synthetic, true);
});
