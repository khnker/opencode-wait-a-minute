import test from "node:test";
import assert from "node:assert/strict";

import { classifyExecutionIntent } from "../../src/execution/task-intent.js";

test("classifies explicit analysis prompts as ANALYZE", () => {
  assert.equal(
    classifyExecutionIntent("Analiza qué mejoras podemos implementar con la sesión"),
    "ANALYZE",
  );
  assert.equal(classifyExecutionIntent("revisa la arquitectura del plugin"), "ANALYZE");
  assert.equal(classifyExecutionIntent("¿por qué no funciona el loop?"), "ANALYZE");
});

test("classifies implementation prompts as IMPLEMENT", () => {
  assert.equal(classifyExecutionIntent("Implementa el fix del login"), "IMPLEMENT");
  assert.equal(classifyExecutionIntent("agrega tests para el gate"), "IMPLEMENT");
  assert.equal(classifyExecutionIntent("refactoriza el orquestador"), "IMPLEMENT");
});

test("classifies trivial edits as INLINE", () => {
  assert.equal(classifyExecutionIntent("rename x to y", { isTrivial: true }), "INLINE");
  assert.equal(classifyExecutionIntent("borra la variable temporal"), "INLINE");
});
