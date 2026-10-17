import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadPrompt, listPrompts, clearCache, parseFrontmatter } from "./loader.js";

test("loader: loads a static prompt verbatim", () => {
  assert.equal(
    loadPrompt("notice.no_active_task"),
    "[wait-a-minute] No hay tarea activa. Dime qué tarea nueva quieres — no asumo intención previa.",
  );
});

test("loader: interpolates all placeholder occurrences", () => {
  assert.equal(
    loadPrompt("notice.pending_task", { active: "task-1", phase: "RUNNING" }),
    "[wait-a-minute] Hay una tarea pendiente: task-1 (fase RUNNING). ¿Quieres continuarla? Responde /wam resume task-1 o define una tarea nueva — no asumo intención.",
  );
});

test("loader: multi-line interpolation is preserved", () => {
  assert.equal(
    loadPrompt("notice.blocked_question", { id: "U1", question: "¿schema?" }),
    "⛔ [wait-a-minute] BLOQUEADO: Pregunta pendiente — U1: ¿schema?\nResponder: /wam answer U1 <respuesta>",
  );
});

test("loader: missing variable throws a diagnostic error", () => {
  assert.throws(() => loadPrompt("nudge.discovery.workdir"), /requires variable "dir"/);
});

test("loader: unknown id throws", () => {
  assert.throws(() => loadPrompt("does.not.exist"), /unknown prompt id/);
});

test("loader: missing file throws", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-prompts-"));
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ prompts: [{ id: "x", path: "nope.md" }] }));
  clearCache();
  try {
    assert.throws(() => loadPrompt("x", {}, { root: dir }), /cannot read prompt/);
  } finally {
    clearCache();
  }
});

test("loader: listPrompts returns catalog entries", () => {
  const entries = listPrompts();
  assert.ok(entries.length > 0);
  assert.ok(entries.every((e) => typeof e.id === "string" && typeof e.path === "string"));
});

test("loader: parseFrontmatter splits metadata and body", () => {
  const { data, body } = parseFrontmatter("---\nid: a.b\nstatus: active\n---\nhello {{x}}\n");
  assert.equal(data.id, "a.b");
  assert.equal(data.status, "active");
  assert.equal(body, "hello {{x}}");
});
