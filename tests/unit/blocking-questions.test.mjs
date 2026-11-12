/**
 * Change: write-tool-autonomy
 * Inferred uncertainty is advisory; only an explicit `blocking: true` unknown
 * parks the turn in ASKING and can be answered with /wam answer.
 *
 * Ejecutar: node --test blocking-questions.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import pluginDefault from "../../index.js";

function stateFile(taskId) {
  return path.join(process.cwd(), ".wam", "tasks", taskId, "task.json");
}
function readState(taskId) {
  return JSON.parse(fs.readFileSync(stateFile(taskId), "utf-8"));
}
function writeState(taskId, state) {
  fs.writeFileSync(stateFile(taskId), JSON.stringify(state, null, 2));
}
function setExplicitBlocker(taskId, question = "¿Alcance de la migración?") {
  const st = readState(taskId);
  st.contract = st.contract || {};
  st.contract.unknowns = [{ id: "U1", status: "blocking", blocking: true, question }];
  st.phase = "ASKING";
  writeState(taskId, st);
}

test("inferred uncertainty is advisory: no ASKING, execution continues", async () => {
  const taskId = `bq-${Date.now()}`;
  const hooks = await pluginDefault({ directory: process.cwd(), client: {}, project: {}, $: {} });
  const out = { message: {}, parts: [] };
  await hooks["chat.message"](
    { sessionID: "b1", message: { parts: [{ type: "text", text: "migra los registros existentes o elimínalos" }] }, taskId },
    out
  );
  const st = readState(taskId);
  assert.notEqual(st.phase, "ASKING", "la incertidumbre inferida no detiene la ejecución");
  assert.ok(
    (st.contract?.unknowns || []).every((u) => u.status !== "blocking"),
    "las dudas inferidas quedan como advisory"
  );
  const emitted = out.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
  assert.ok(emitted.includes("Recomendación"), "emite recomendación advisory");
  try { fs.rmSync(path.join(process.cwd(), ".wam", "tasks", taskId), { recursive: true, force: true }); } catch {}
});

test("R6: DONE mientras ASKING explícito → interceptado, no avanza", async () => {
  const taskId = `bq-g-${Date.now()}`;
  const hooks = await pluginDefault({ directory: process.cwd(), client: {}, project: {}, $: {} });
  await hooks["chat.message"](
    { sessionID: "b2", message: { parts: [{ type: "text", text: "migra los registros existentes o elimínalos" }] }, taskId },
    { message: {}, parts: [] }
  );
  setExplicitBlocker(taskId);
  const out2 = { message: {}, parts: [] };
  const inp2 = { parts: [{ type: "text", text: "terminé, done" }], taskId };
  await hooks["chat.message"]({ sessionID: "b3", message: { parts: inp2.parts }, taskId }, out2);
  const st = readState(taskId);
  assert.equal(st.phase, "ASKING", "sigue en ASKING, no avanza a DONE");
  const emitted = out2.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
  assert.ok(emitted.includes("U1"), "re-emite la pregunta bloqueante");
  assert.ok(emitted.includes("/wam answer U1"), "re-emite instrucción de respuesta");
  try { fs.rmSync(path.join(process.cwd(), ".wam", "tasks", taskId), { recursive: true, force: true }); } catch {}
});

test("flujo explícito: ASKING → answer → PROPOSED → approve → IMPLEMENTING", async () => {
  const taskId = `bq-a-${Date.now()}`;
  const hooks = await pluginDefault({ directory: process.cwd(), client: {}, project: {}, $: {} });
  await hooks["chat.message"](
    { sessionID: "b4", message: { parts: [{ type: "text", text: "migra los registros existentes o elimínalos" }] }, taskId },
    { message: {}, parts: [] }
  );
  setExplicitBlocker(taskId);
  await hooks["command.execute.before"]({ command: "wam", arguments: `task switch ${taskId}`, sessionID: "b4" }, { parts: [] });
  const out = { parts: [] };
  await hooks["command.execute.before"]({ command: "wam", arguments: "answer U1 migrar", sessionID: "b4" }, out);
  const res = JSON.parse(out.parts[0].text.replace(/^\[wam\] /, ""));
  assert.equal(res.ok, true, "respuesta registrada");
  const st = readState(taskId);
  assert.equal(st.phase, "PROPOSED", "vuelve a PROPOSED tras responder");
  assert.equal(st.contract.unknowns[0].status, "answered", "unknown respondida");
  assert.equal(st.contract.unknowns[0].answer, "migrar", "respuesta persistida");
  const approved = pluginDefault.approveContract(taskId);
  assert.equal(approved.ok, true, "aprobación permitida tras respuesta");
  try { fs.rmSync(path.join(process.cwd(), ".wam", "tasks", taskId), { recursive: true, force: true }); } catch {}
});

test("Fast path: tarea sin incertidumbre nunca entra a ASKING", async () => {
  const taskId = `bq-f-${Date.now()}`;
  const hooks = await pluginDefault({ directory: process.cwd(), client: {}, project: {}, $: {} });
  const out = { message: {}, parts: [] };
  await hooks["chat.message"](
    { sessionID: "b5", message: { parts: [{ type: "text", text: "refactoriza el módulo de pagos" }] }, taskId },
    out
  );
  const st = readState(taskId);
  assert.notEqual(st.phase, "ASKING", "no entra a ASKING");
  try { fs.rmSync(path.join(process.cwd(), ".wam", "tasks", taskId), { recursive: true, force: true }); } catch {}
});
