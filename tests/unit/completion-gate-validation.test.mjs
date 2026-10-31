/**
 * Completion gate — inyección advisory al LLM.
 *
 * Escenario: el LLM declara DONE pero el contrato todavía tiene requisitos
 * pendientes. El contrato "zero friction / advisory" establece que WAM nunca
 * bloquea: el claim recibe contexto advisory (Tarea N2 con los requisitos
 * pendientes) y su aviso NUNCA contiene una directiva de bloqueo (⛔ / COMPLETION GATE /
 * "afirmación de completitud rechazada").
 *
 * WAM debe:
 *   1. inyectar el contexto advisory en todas las formas de output que usa
 *      OpenCode ({ parts } y { message: { parts } }) — antes se perdía en
 *      silencio;
 *   2. disparar el gate con las frases de completitud reales ("terminado,
 *      done", "todo listo, done");
 *   3. no repetir el mismo contexto advisory en claims consecutivos de la
 *      misma sesión.
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
const RUN = `${process.pid}-${Date.now()}`;
const sid = (label) => `cgv-${label}-${RUN}`;

async function runHook(prompt, taskId, sessionID, providedOutput) {
  const hooks = await pluginDefault({ directory: CWD, client: {}, project: {}, $: {} });
  const output = providedOutput || { message: {}, parts: [] };
  await hooks["chat.message"]({ sessionID, message: { parts: [{ type: "text", text: prompt }] }, taskId }, output);
  return output;
}

function cleanup(taskId) {
  try { fs.rmSync(path.join(CWD, ".wam", "tasks", taskId), { recursive: true, force: true }); } catch {}
}

/** Aviso advisory emitido para un claim con requisitos pendientes (design actual). */
const ADVISORY_NOTICE = "Recomendación: faltan";

function findPart(parts, needle) {
  return (parts || []).find(
    (p) => p?.type === "text" && typeof p.text === "string" && p.text.includes(needle),
  );
}

function findAdvisoryNotice(parts) {
  return findPart(parts, ADVISORY_NOTICE);
}

function partText(parts) {
  return (parts || [])
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("\n");
}

function assertNoHardBlockDirective(parts) {
  // El aviso advisory es la única respuesta del gate al claim: no debe contener
  // rechazo duro ni directiva de bloqueo. Si el output trae otras partes
  // (contexto de sesión), se evalúa el aviso concreto.
  const notice = findAdvisoryNotice(parts);
  const text = notice ? notice.text : partText(parts);
  assert.doesNotMatch(text, /⛔/, "sin aviso de gate bloqueante");
  assert.doesNotMatch(text, /COMPLETION GATE/, "sin etiqueta de gate bloqueante");
  assert.doesNotMatch(text, /No declares DONE/i, "sin directiva de bloqueo");
  assert.doesNotMatch(text, /declaró DONE|rechazada/i, "sin rechazo duro del claim");
}

test("unit: buildCompletionValidation cita el objetivo del contrato y lo que falta", () => {
  const validation = buildCompletionValidation(
    { blocked: false, advisory: true, pending: ["req-2 — Agregar tests para el cambio"] },
    {
      nextAction: "Implementar req-2",
      contract: { objective: "Endurecer el parser de entradas" },
    },
  );
  assert.equal(validation.requestedAction, "Endurecer el parser de entradas");
  assert.match(validation.text, /Recomendación/);
  assert.match(validation.text, /req-2 — Agregar tests para el cambio/);
  assert.match(validation.text, /Objetivo del contrato: "Endurecer el parser de entradas"/);
  assert.doesNotMatch(validation.text, /Listo, continúa/);
  assert.doesNotMatch(validation.text, /No declares DONE/);
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

test("e2e: claim de completitud con requisitos pendientes → aviso advisory", async () => {
  const taskId = `cgv-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, sid("a"));
  pluginDefault.approveContract(taskId);
  const pendingReq = getTaskState(taskId).requirements[0];

  const out = await runHook("Listo, ya está todo hecho", taskId, sid("b"));
  cleanup(taskId);

  const context = findAdvisoryNotice(out.parts);
  assert.ok(context, "el claim recibe el aviso advisory de requisitos pendientes");
  assert.ok(context.text.includes(pendingReq.id), "sigue mostrando el requisito pendiente");
  assert.match(partText(out.parts), /req:\s*\d+(?:\/\d+)? pend/i, "el estado pendiente permanece visible");
  assertNoHardBlockDirective(out.parts);
});

test("e2e: claim de completitud en español ('terminado, done') también recibe el contexto advisory", async () => {
  const taskId = `cgv-es-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, sid("c"));
  pluginDefault.approveContract(taskId);

  const out = await runHook("terminado, done", taskId, sid("d"));
  cleanup(taskId);

  assert.ok(findAdvisoryNotice(out.parts), "el claim en español recibe el aviso advisory");
  assert.match(partText(out.parts), /implementar X y agregar tests/i, "el objetivo del contrato se mantiene");
  assertNoHardBlockDirective(out.parts);
});

test("e2e: el contexto advisory llega cuando el output sólo tiene message.parts", async () => {
  const taskId = `cgv-msg-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, sid("e"));
  pluginDefault.approveContract(taskId);

  // Shape de OpenCode sin output.parts: la inyección no debe perderse.
  const out = { message: { parts: [] } };
  await runHook("Listo, ya está todo hecho", taskId, sid("f"), out);
  cleanup(taskId);

  const context = findAdvisoryNotice(out.message.parts);
  assert.ok(context, "el aviso advisory llega al LLM en message.parts");
  assert.match(context.text, /implementar X y agregar tests/i);
  assertNoHardBlockDirective(out.message.parts);
});

test("e2e: una instrucción normal no arrastra el gate de un contrato viejo", async () => {
  const taskId = `cgv-scope-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, sid("s1"));
  pluginDefault.approveContract(taskId);

  const out = await runHook("agregá logs al parser", taskId, sid("s2"));
  cleanup(taskId);

  assertNoHardBlockDirective(out.parts);
});

test("e2e: un claim de completitud inyecta el aviso advisory de requisitos pendientes", async () => {
  const taskId = `cgv-claim-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, sid("c1"));
  pluginDefault.approveContract(taskId);

  const out = await runHook("Listo, ya está todo hecho", taskId, sid("c2"));
  cleanup(taskId);

  assert.ok(findAdvisoryNotice(out.parts), "debe inyectar el aviso advisory de requisitos pendientes");
  assertNoHardBlockDirective(out.parts);
});

test("e2e: 'listo sigue' es continuación, no claim, y no inyecta directivas", async () => {
  const taskId = `cgv-cont-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, sid("r1"));
  pluginDefault.approveContract(taskId);

  const out = await runHook("listo sigue", taskId, sid("r2"));
  cleanup(taskId);

  assertNoHardBlockDirective(out.parts);
});

test("e2e: el aviso advisory no se repite en claims consecutivos de la misma sesión", async () => {
  const taskId = `cgv-dup-${Date.now()}`;
  await runHook("implementar X y agregar tests", taskId, sid("d1"));
  pluginDefault.approveContract(taskId);

  const first = await runHook("Listo, ya está todo hecho", taskId, sid("dup"));
  const second = await runHook("Listo, ya está todo hecho", taskId, sid("dup"));
  cleanup(taskId);

  assert.ok(findAdvisoryNotice(first.parts), "el primer claim sí recibe el aviso advisory");
  assert.equal(findAdvisoryNotice(second.parts), undefined, "no repite el aviso advisory con los mismos pendientes");
  assertNoHardBlockDirective(first.parts);
  assertNoHardBlockDirective(second.parts);
});

test("unit: las partes inyectadas llevan sessionID, messageID e id único (schema 1.19)", async () => {
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
  assert.match(out.parts[0].id, /^prt_[0-9a-f]{16}$/, "sin id, OpenCode rechaza el prompt entero");
});
