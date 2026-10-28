/**
 * Completion gate — inyección de la validación al LLM.
 *
 * Escenario: el LLM declara DONE pero el contrato todavía tiene requisitos
 * pendientes. WAM debe:
 *   1. enviar la advertencia/validación al LLM (parte propia) con lo que
 *      falta y el objetivo real del contrato (nunca una frase inventada);
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

test("unit: buildCompletionValidation cita el objetivo del contrato y lo que falta", () => {
  const validation = buildCompletionValidation(
    { blocked: true, pending: ["req-2 — Agregar tests para el cambio"] },
    {
      nextAction: "Implementar req-2",
      contract: { objective: "Endurecer el parser de entradas" },
    },
  );
  assert.equal(validation.requestedAction, "Endurecer el parser de entradas");
  assert.match(validation.text, /VALIDACIÓN/);
  assert.match(validation.text, /req-2 — Agregar tests para el cambio/);
  assert.match(validation.text, /Objetivo del contrato: "Endurecer el parser de entradas"/);
  assert.doesNotMatch(validation.text, /Listo, continúa/);
  assert.match(validation.text, /No declares DONE/);
  assert.match(validation.text, /Continuar con: Implementar req-2/);
});

test("unit: sin objetivo de contrato cae en el goal de la intención original", () => {
  const validation = buildCompletionValidation(
    { blocked: true, pending: ["req-2"] },
    { intent: { goal: "arreglar el login\nsegunda línea" } },
  );
  assert.equal(validation.requestedAction, "arreglar el login");
  assert.match(validation.text, /Objetivo del contrato: "arreglar el login"/);
});

test("unit: el gate dispara con las frases de completitud que antes lo evadían", () => {
  for (const claim of [
    "terminado, done",
    "todo listo, done",
    "todo verificado, tarea completa done",
    "ya está, todo ok",
    "COMPLETED. Eliminé la triplicación de formatPrice.",
    "FINISHED: all tests green",
  ]) {
    assert.equal(isCompletionIntent(claim), true, `debe clasificar como claim: ${claim}`);
  }
  for (const notClaim of [
    "this is a complete disaster",
    "the unfinished file",
    "could you complete the form?",
    "when will it be done?",
    "listo sigue",
    "listo, continúa",
    "ok seguí",
    "dale, procede",
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
  assert.match(validation.text, /Objetivo del contrato: ".*implementar X y agregar tests"/i);
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
  assert.match(validation.text, /Objetivo del contrato: ".*implementar X y agregar tests"/i);
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
  assert.match(validation.text, /Objetivo del contrato: ".*implementar X y agregar tests"/i);
});

test("e2e: una instrucción normal no arrastra el gate de un contrato viejo", async () => {
  const taskId = `cgv-scope-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, "cgv-s1");
  pluginDefault.approveContract(taskId);

  const out = await runHook("agregá logs al parser", taskId, "cgv-s2");
  cleanup(taskId);

  assert.ok(!findPart(out.parts, "COMPLETION GATE"), "no debe inyectar el aviso de gate");
  assert.ok(!findPart(out.parts, "VALIDACIÓN"), "no debe inyectar la validación");
});

test("e2e: un claim de completitud sí inyecta el gate y la validación", async () => {
  const taskId = `cgv-claim-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, "cgv-c1");
  pluginDefault.approveContract(taskId);

  const out = await runHook("Listo, ya está todo hecho", taskId, "cgv-c2");
  cleanup(taskId);

  assert.ok(findPart(out.parts, "COMPLETION GATE"), "debe inyectar el aviso de gate");
  assert.ok(findPart(out.parts, "VALIDACIÓN"), "debe inyectar la validación");
});

test("e2e: 'listo sigue' es continuación, no claim, y no dispara el gate", async () => {
  const taskId = `cgv-cont-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, "cgv-r1");
  pluginDefault.approveContract(taskId);

  const out = await runHook("listo sigue", taskId, "cgv-r2");
  cleanup(taskId);

  assert.ok(!findPart(out.parts, "COMPLETION GATE"), "no debe avisar el gate");
  assert.ok(!findPart(out.parts, "VALIDACIÓN"), "no debe inyectar la validación");
});

test("e2e: el gate no repite el mismo aviso en turnos consecutivos", async () => {
  const taskId = `cgv-dup-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, "cgv-d1");
  pluginDefault.approveContract(taskId);

  const first = await runHook("Listo, ya está todo hecho", taskId, "cgv-d2");
  const second = await runHook("Listo, ya está todo hecho", taskId, "cgv-d3");
  cleanup(taskId);

  assert.ok(findPart(first.parts, "COMPLETION GATE"), "el primer claim sí avisa");
  assert.ok(!findPart(second.parts, "COMPLETION GATE"), "no repite el aviso idéntico");
  assert.ok(!findPart(second.parts, "VALIDACIÓN"), "no repite la validación idéntica");
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
