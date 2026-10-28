import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { synthesizeContract } from "../../src/skills/engine.js";
import pluginDefault from "../../index.js";

const META = "arregla todo, no te detenga, ahora eres responsable de wam de que esta todo bien";

test("meta prompt yields no fabricated requirements", () => {
  const contract = synthesizeContract(META, "NORMAL");
  assert.equal(contract.trivial, true);
  assert.deepEqual(contract.requirements, []);
});

test("continuation instruction yields no fabricated requirements", () => {
  for (const prompt of ["listo sigue", "listo, continúa", "ok seguí", "dale, procede"]) {
    const contract = synthesizeContract(prompt, "NORMAL");
    assert.equal(contract.trivial, true, prompt);
    assert.deepEqual(contract.requirements, [], prompt);
  }
});

test("FAST mode never synthesizes a contract", () => {  const contract = synthesizeContract(META, "FAST");
  assert.equal(contract.trivial, true);
  assert.deepEqual(contract.requirements, []);
});

test("trivial meta prompt does not emit a completion gate", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-meta-"));
  const hooks = await pluginDefault({ directory: root, client: {}, project: {}, $: {} });
  const out = { message: { id: "meta-1" }, parts: [] };
  await hooks["chat.message"](
    { sessionID: "meta-session", messageID: "meta-1", message: { parts: [{ type: "text", text: "responde solo: ok" }] } },
    out
  );
  const text = out.parts.map((p) => p.text || "").join("\n");
  assert.ok(!/COMPLETION GATE|VALIDACIÓN/.test(text), "no gate for a trivial message");
  fs.rmSync(root, { recursive: true, force: true });
});
