/**
 * Characterization tests — pre-migration literals, captured as the source of
 * truth for byte-for-byte equivalence after centralization.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { loadPrompt } from "./loader.js";

const STATIC = {
  "nudge.discovery.grep": "Consider using the dedicated 'grep' tool or 'context-query-engine' MCP (search_files / context_query) instead of raw bash search.",
  "nudge.discovery.glob": "Consider using the dedicated 'glob' tool instead of raw bash file listing/finding.",
  "nudge.discovery.read": "Consider using the dedicated 'read' tool or 'context-query-engine' MCP (read_file) instead of raw bash file reading.",
  "nudge.discovery.default": "Consider using dedicated tools (`grep`, `glob`, `read`) or the `context-query-engine` MCP instead of raw bash discovery.",
  "warning.runtime.guarded_no_hypothesis": "GUARDED action without hypothesisId — attach hypothesis before mutating.",
  "notice.no_active_task": "[wait-a-minute] No hay tarea activa. Dime qué tarea nueva quieres — no asumo intención previa.",
  "notice.blocked_generic": "⛔ [wait-a-minute] BLOQUEADO: Tienes preguntas sin responder.",
  "notice.new_intent": "[wait-a-minute] Nueva intención detectada. Abriendo tarea nueva.",
  "injection.delegation": "[wam delegation] Reqs pendientes → delegar en PARALELO via Task (agente: el apropiado según config del entorno). Mutación directa de archivos desde la sesión principal está BLOQUEADA — solo un subagente ejecuta write/edit.",
};

for (const [id, expected] of Object.entries(STATIC)) {
  test(`characterization: ${id}`, () => {
    assert.equal(loadPrompt(id), expected);
  });
}

test("characterization: nudge.discovery.workdir", () => {
  assert.equal(
    loadPrompt("nudge.discovery.workdir", { dir: "src" }),
    `Consider using the 'workdir' parameter ('workdir: "src"') instead of 'cd src && ...' in bash.`,
  );
});

test("characterization: nudge.runtime.redundant_read", () => {
  assert.equal(
    loadPrompt("nudge.runtime.redundant_read", { path: "a.js" }),
    "redundant read: a.js unchanged since last read in this session",
  );
});

test("characterization: reason.runtime.stale_buffer", () => {
  assert.equal(
    loadPrompt("reason.runtime.stale_buffer", { path: "a.js" }),
    "stale buffer: a.js changed since last read; re-read the file before editing",
  );
});

test("characterization: warning.runtime.repetition", () => {
  assert.equal(
    loadPrompt("warning.runtime.repetition", { status: "FAILED" }),
    "Repetición detectada: ya se intentó FAILED. Considera replanificar.",
  );
});

test("characterization: notice.blocked_question", () => {
  assert.equal(
    loadPrompt("notice.blocked_question", { id: "U2", question: "¿q?" }),
    "⛔ [wait-a-minute] BLOQUEADO: Pregunta pendiente — U2: ¿q?\nResponder: /wam answer U2 <respuesta>",
  );
});

test("characterization: notice.blocked_prefix", () => {
  assert.equal(
    loadPrompt("notice.blocked_prefix", { directive: "D" }),
    "[wait-a-minute] BLOQUEADO — prompt de implementación no consumido como respuesta. D",
  );
});

test("characterization: notice.question_answered", () => {
  assert.equal(
    loadPrompt("notice.question_answered", { id: "U1", answer: "yes", question: "¿q?" }),
    "[wait-a-minute] question answered — U1: yes. Ready → Proceed (¿q?)",
  );
});

test("characterization: notice.similar_task", () => {
  assert.equal(
    loadPrompt("notice.similar_task", { taskId: "task-9" }),
    "[wait-a-minute] Tarea similar detectada: task-9 (usa /wam task switch task-9 para retomar)",
  );
});

test("characterization: notice.completion_gate", () => {
  assert.equal(
    loadPrompt("notice.completion_gate", { count: 2, pendingList: " P", nextAction: "next" }),
    "⛔ [wait-a-minute] COMPLETION GATE: faltan 2 requisito(s). No declare DONE. P Continuar con: next",
  );
});

test("characterization: warning.contradiction.unresolved", () => {
  assert.equal(
    loadPrompt("warning.contradiction.unresolved", { count: 3 }),
    "  ⚠ 3 unresolved conflict(s) — do not choose silently",
  );
});

test("characterization: injection.n2_task", () => {
  assert.equal(loadPrompt("injection.n2_task", { live: "L" }), "[wam N2 task]\nL");
});

test("characterization: injection.continuation", () => {
  assert.equal(
    loadPrompt("injection.continuation", { signals: "a, b" }),
    "[wam continuation] Contexto reconstruido (a, b)",
  );
});

test("characterization: injection.delegation_item", () => {
  assert.equal(
    loadPrompt("injection.delegation_item", { id: "R1", title: "t", hint: " [contexto: x]" }),
    '  R1 → Task(parallel) "t" [contexto: x]',
  );
  assert.equal(
    loadPrompt("injection.delegation_item", { id: "R1", title: "t", hint: "" }),
    '  R1 → Task(parallel) "t"',
  );
});

test("characterization: injection.delegation_overflow", () => {
  assert.equal(
    loadPrompt("injection.delegation_overflow", { count: 4 }),
    "  ...(+4 requisitos adicionales consolidados)",
  );
});

test("characterization: policies preserve order", () => {
  assert.deepEqual(loadPrompt("policy.scope.rules").split("\n"), [
    "Entregar únicamente lo pedido — sin expansión de alcance",
    "No agregar features no solicitadas",
    "No refactorizar código ajeno a la tarea",
    "Cambiar la mínima superficie posible",
  ]);
  assert.deepEqual(loadPrompt("policy.verify.rules").split("\n"), [
    "Toda implementación debe tener resultado verificable",
    "Ninguna tarea se marca DONE sin evidencia satisfecha",
    "Ejecutar tests/lint/typecheck de los artefactos tocados",
    "Verificar consumidores de los cambios, no solo el cambio",
  ]);
  assert.deepEqual(loadPrompt("policy.simplify.rules").split("\n"), [
    "YAGNI — no construir para necesidades futuras especulativas",
    "Reusar código y abstracciones existentes",
    "Preferir mecanismos nativos y stdlib cuando aplique",
    "Implementación mínima y superficie de cambio mínima",
    "Evitar dependencias innecesarias y generalización prematura",
    "Abstracción solo cuando el requerimiento la exige ahora",
  ]);
});

test("characterization: injection.decision_gate", () => {
  assert.equal(
    loadPrompt("injection.decision_gate", { label: "Cambio de arquitectura" }),
    "Bifurcación detectada (Cambio de arquitectura): subagente DEBE invocar tracer.logTechnicalDecision(decisionPoint, rationale, alternatives[], evidence[], technicalMetrics{}) antes de implementar.",
  );
});

test("characterization: injection.simplify_protected", () => {
  assert.equal(
    loadPrompt("injection.simplify_protected", { hits: "security, datos" }),
    "Protegido por Simplify: NO eliminar security, datos — simplificar implementación, no la restricción",
  );
});

test("characterization: backlog prompts", () => {
  assert.equal(loadPrompt("injection.backlog_header", { count: 2 }), "[wam backlog] 2 requerimiento(s) fuera de alcance:");
  assert.equal(loadPrompt("injection.backlog_item", { id: "B1", title: "t" }), "  B1: t");
  assert.equal(loadPrompt("injection.backlog_overflow", { count: 3 }), "  ...(+3 más)");
});

test("characterization: question.escalation", () => {
  assert.equal(loadPrompt("question.escalation", { statement: "usar X" }), "¿usar X?");
});
