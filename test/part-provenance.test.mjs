/**
 * Tests for src/integration/part-provenance.js — single tagged injection channel.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  WAM_META,
  tagWamPart,
  isWamSynthetic,
  hasWamMarkerFor,
  injectWamParts,
} from "../src/integration/part-provenance.js";

test("tagWamPart marks provenance", () => {
  const p = tagWamPart({ type: "text", text: "x" }, { messageID: "m1", phase: "emit" });
  assert.equal(p.synthetic, true);
  assert.equal(p.metadata[WAM_META], true);
  assert.equal(p.metadata.wamMessageId, "m1");
  assert.equal(p.metadata.wamPhase, "emit");
});

test("tagWamPart preserves metadata and applies idFactory", () => {
  const p = tagWamPart({ type: "text", text: "x", metadata: { k: 1 } }, { idFactory: () => "prt_abc" });
  assert.equal(p.metadata.k, 1);
  assert.equal(p.id, "prt_abc");
});

test("isWamSynthetic only true for tagged parts", () => {
  assert.equal(isWamSynthetic({ synthetic: true }), false);
  assert.equal(isWamSynthetic(tagWamPart({ type: "text", text: "x" }, {})), true);
  assert.equal(isWamSynthetic(null), false);
});

test("hasWamMarkerFor matches by messageID", () => {
  const parts = [tagWamPart({ type: "text", text: "x" }, { messageID: "m1" })];
  assert.equal(hasWamMarkerFor(parts, "m1"), true);
  assert.equal(hasWamMarkerFor(parts, "m2"), false);
  assert.equal(hasWamMarkerFor(parts, null), true);
  assert.equal(hasWamMarkerFor([], "m1"), false);
});

test("injectWamParts prepends tagged parts to parts sink", () => {
  const target = { parts: [{ type: "text", text: "user" }] };
  injectWamParts(target, ["injected"], { messageID: "m1", phase: "emit" });
  assert.equal(target.parts.length, 2);
  assert.equal(target.parts[0].text, "injected");
  assert.equal(target.parts[0].metadata[WAM_META], true);
});

test("injectWamParts appends when requested and falls back to system", () => {
  const target = { parts: [{ type: "text", text: "user" }] };
  injectWamParts(target, ["a", "b"], { position: "append" });
  assert.equal(target.parts[target.parts.length - 1].text, "b");
  const legacy = { system: [] };
  injectWamParts(legacy, "s", {});
  assert.equal(legacy.system[0].text, "s");
});

test("injectWamParts is a no-op without a sink", () => {
  assert.doesNotThrow(() => injectWamParts({}, ["x"]));
});
