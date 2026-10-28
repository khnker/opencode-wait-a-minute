import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  clearIntentDictionaryCache,
  createIntentDictionary,
  dictionaryKey,
  getIntentDictionary,
  loadIntentDictionary,
  normalizeMessage,
  saveIntentDictionary,
} from "./intent-dictionary.js";

const obs = {
  intent: "META",
  confidence: 0.9,
  contributions: [],
  claims: [],
  risk_flags: [],
};

test("normalizeMessage removes accents and punctuation", () => {
  assert.equal(normalizeMessage("  ¡Reiniciado, ve si está OK!  "), "reiniciado ve si esta ok");
});

test("same message under different state signatures does not collide", () => {
  const proposed = { requirements: [{ status: "pending" }], phase: "PROPOSED", contract: { status: "PROPOSED" } };
  const approved = { requirements: [{ status: "pending" }], phase: "APPROVED", contract: { status: "APPROVED" } };
  assert.notEqual(
    dictionaryKey("sí", proposed, { stage: "CONTRACTING", pendingQuestion: "contract_approval" }),
    dictionaryKey("sí", approved, { stage: "APPROVED", pendingQuestion: null })
  );
});

test("dictionary caches high-confidence observations and respects maxEntries", () => {
  const dict = createIntentDictionary({ maxEntries: 2 });
  const task = { requirements: [{ status: "pending" }], phase: "APPROVED", contract: { status: "APPROVED" } };
  assert.equal(dict.set("hazlo", task, null, obs), true);
  assert.equal(dict.set("listo", task, null, { ...obs, confidence: 0.2 }), false);
  assert.equal(dict.get("hazlo", task, null).intent, "META");
  dict.set("sigue", task, null, obs);
  dict.set("verifica", task, null, obs);
  assert.equal(dict.size(), 2);
});

test("dictionary persists and reloads from .wam", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-dialogue-"));
  const dict = createIntentDictionary();
  const task = { requirements: [{ status: "pending" }], phase: "PROPOSED", contract: { status: "PROPOSED" } };
  dict.set("sí", task, { stage: "CONTRACTING", pendingQuestion: "contract_approval" }, obs);
  saveIntentDictionary(root, dict);

  const loaded = loadIntentDictionary(root);
  assert.equal(
    loaded.get("sí", task, { stage: "CONTRACTING", pendingQuestion: "contract_approval" }).intent,
    "META"
  );
  clearIntentDictionaryCache();
  const shared = getIntentDictionary(root);
  assert.equal(
    shared.get("sí", task, { stage: "CONTRACTING", pendingQuestion: "contract_approval" }).source,
    "dictionary"
  );
});
