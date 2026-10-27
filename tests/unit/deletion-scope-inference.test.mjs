import test from "node:test";
import assert from "node:assert/strict";

import { extractPromptCriticalUncertainties } from "../../src/skills/engine.js";

test("explicit deletion target does not ask for scope", () => {
  assert.deepEqual(extractPromptCriticalUncertainties("borra el archivo /tmp/foo.txt"), []);
});

test("explicit hard/soft delete does not ask for scope", () => {
  assert.deepEqual(
    extractPromptCriticalUncertainties("elimina los usuarios con hard delete"),
    []
  );
});

test("a concrete URL reference is enough context", () => {
  assert.deepEqual(
    extractPromptCriticalUncertainties(
      "si pido algo http://10.10.10.100:5000/server/x/session/ses_e826bb3d9ffeTku744w6Bv48Gs donde ya se explicita que hay que borrar no debería pedir confirmación"
    ),
    []
  );
});

test("ambiguous deletion still asks for scope", () => {
  const found = extractPromptCriticalUncertainties("borra los datos");
  assert.equal(found.length, 1);
  assert.match(found[0].question, /Alcance de la eliminación/);
});

test("migrate-or-delete keeps its own question", () => {
  const found = extractPromptCriticalUncertainties("migra o elimina los datos");
  assert.equal(found.length, 1);
  assert.match(found[0].question, /migrarse o eliminarse/);
});
