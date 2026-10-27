import test from "node:test";
import assert from "node:assert/strict";

import { synthesizeContract } from "../../src/skills/engine.js";
import { nextActionFrom } from "../../src/integration/orchestration.js";

const PROSE =
  "Analiza si hay mas problemas basado en los archivos de las carpetas .wam. revisa log, archivos para ver que esta fallando y como corregirlo";

test("prose prompts are split by sentence, not by every comma", () => {
  const contract = synthesizeContract(PROSE, "NORMAL");
  assert.deepEqual(contract.requirements, [
    "Analiza si hay mas problemas basado en los archivos de las carpetas .wam",
    "Revisa log, archivos para ver que esta fallando y como corregirlo",
  ]);
});

test("requirement titles keep their verb and avoid double prefixes", () => {
  assert.equal(
    nextActionFrom({
      requirements: [{ id: "req-1", title: "Implementar: Todo", status: "pending" }],
    }),
    "Implementar: Todo (req-1 pending)"
  );
  assert.equal(
    nextActionFrom({
      requirements: [{ id: "req-1", title: "todo", status: "pending" }],
    }),
    "Implementar todo (req-1 pending)"
  );
});
