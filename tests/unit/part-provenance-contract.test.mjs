import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PART_ID_PREFIX,
  defaultPartId,
  injectWamParts,
  tagWamPart,
  validateWamPart,
} from "../../src/integration/part-provenance.js";

const PART_ID = /^prt_[0-9a-f]{16}$/;

function assertValidPart(part) {
  const { valid, errors } = validateWamPart(part);
  assert.equal(valid, true, `part inválido: ${errors.join("; ")}`);
  assert.match(part.id, PART_ID);
}

describe("part-provenance contract", () => {
  it("defaultPartId devuelve ids prt_ únicos", () => {
    const ids = new Set(Array.from({ length: 200 }, () => defaultPartId()));
    assert.equal(ids.size, 200);
    for (const id of ids) {
      assert.ok(id.startsWith(PART_ID_PREFIX));
      assert.match(id, PART_ID);
    }
  });

  it("no se puede inyectar un part sin id (fallo de producción con CPC)", () => {
    const sink = { parts: [] };
    const result = injectWamParts(sink, "[wam CPC] canonical project context", {
      sessionID: "ses_test",
      messageID: "msg_test",
      phase: "cpc",
      position: "append",
    });
    assert.deepEqual(result, { inserted: 1, dropped: 0 });
    assert.equal(sink.parts.length, 1);
    assertValidPart(sink.parts[0]);
    assert.equal(sink.parts[0].sessionID, "ses_test");
    assert.equal(sink.parts[0].messageID, "msg_test");
    assert.equal(sink.parts[0].metadata.wamPhase, "cpc");
  });

  it("validateWamPart rechaza exactamente el part que rompía la sesión", () => {
    const { valid, errors } = validateWamPart({ type: "text", text: "x" });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes("id")));
  });

  it("preserva el id del caller cuando es válido", () => {
    const sink = { parts: [] };
    injectWamParts(sink, { id: "prt_0123456789abcdef", type: "text", text: "aviso" }, {
      sessionID: "ses_test",
      messageID: "msg_test",
      phase: "emit",
    });
    assert.equal(sink.parts[0].id, "prt_0123456789abcdef");
  });

  it("regenera ids que colisionan con el sink o entre inyecciones", () => {
    const sink = { parts: [{ id: "prt_0000000000000000", type: "text", text: "previo" }] };
    injectWamParts(sink, { id: "prt_0000000000000000", type: "text", text: "a" }, { sessionID: "ses", messageID: "msg" });
    injectWamParts(sink, { id: "prt_0000000000000000", type: "text", text: "b" }, { sessionID: "ses", messageID: "msg" });
    const ids = sink.parts.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const part of sink.parts) assertValidPart(part);
  });

  it("descarta parts inválidos y conserva los válidos (nunca lanza)", () => {
    const sink = { parts: [] };
    const result = injectWamParts(sink, [
      { type: "text", text: "" },
      { type: "text", text: "válido" },
      { type: "text" },
    ], { sessionID: "ses_test", messageID: "msg_test", phase: "emit" });
    assert.equal(result.dropped, 2);
    assert.equal(result.inserted, 1);
    assert.equal(sink.parts.length, 1);
    assert.equal(sink.parts[0].text, "válido");
    assertValidPart(sink.parts[0]);
  });

  it("reemplaza ids malformados del caller por uno válido", () => {
    const sink = { parts: [] };
    injectWamParts(sink, { id: 42, type: "text", text: "id inválido" }, {
      sessionID: "ses_test",
      messageID: "msg_test",
      phase: "emit",
    });
    assert.equal(sink.parts.length, 1);
    assertValidPart(sink.parts[0]);
  });

  it("tagWamPart no muta el part de entrada", () => {
    const input = { type: "text", text: "sin id" };
    const tagged = tagWamPart(input, { sessionID: "ses_test", messageID: "msg_test", phase: "emit" });
    assert.equal(input.id, undefined);
    assert.notEqual(tagged, input);
    assertValidPart(tagged);
  });

  it("soporta el shape anidado message.parts", () => {
    const output = { message: { id: "msg_nested", parts: [] } };
    injectWamParts(output, "aviso", { sessionID: "ses_test", messageID: "msg_nested", phase: "emit" });
    assert.equal(output.message.parts.length, 1);
    assertValidPart(output.message.parts[0]);
  });
});
