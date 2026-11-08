import test from "node:test";
import assert from "node:assert/strict";
import { emitTextPart } from "../index.js";
import { isWamSynthetic } from "../src/integration/part-provenance.js";

test("synthetic WAM notices go to system and leave user parts untouched", () => {
  const output = { parts: [{ id: "prt_user", type: "text", text: "hola" }], system: [] };

  emitTextPart(output, "nota interna", { sessionID: "s1", messageID: "m1" });

  assert.equal(output.parts.length, 1);
  assert.equal(output.system.length, 1);
  assert.equal(output.system[0].text, "[wam] nota interna");
  assert.ok(isWamSynthetic(output.system[0]));
});

test("explicit user-facing WAM summaries stay in parts", () => {
  const output = { parts: [{ id: "prt_user", type: "text", text: "hola" }], system: [] };

  emitTextPart(output, "resumen final", {
    sessionID: "s1",
    messageID: "m1",
    synthetic: false,
  });

  assert.equal(output.system.length, 0);
  assert.equal(output.parts.length, 2);
  assert.equal(output.parts[0].text, "[wam] resumen final");
});

test("synthetic WAM notices fall back to parts when no system sink exists", () => {
  const output = { parts: [{ id: "prt_user", type: "text", text: "hola" }] };

  emitTextPart(output, "nota interna", { sessionID: "s1", messageID: "m1" });

  assert.equal(output.parts.length, 2);
  assert.equal(output.parts[0].text, "[wam] nota interna");
  assert.ok(isWamSynthetic(output.parts[0]));
});
