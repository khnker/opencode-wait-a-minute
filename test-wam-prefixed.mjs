import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import WaitAMinutePlugin from "./index.js";

test("emitTextPart inyecta prefijo [wam] al frente del texto visible en partes sintéticas", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-test-"));

  const plugin = await WaitAMinutePlugin({
    directory: tmpDir,
    debug: true,
    skills: [],
    wamConfig: { enableAll: true },
  });

  const sessionID = "test-session";
  const input = {
    sessionID,
    messageID: "msg-test",
    message: {
      parts: [
        { type: "text", text: "Hola mundo" }
      ]
    }
  };
  const output = {
    parts: []
  };

  await plugin["chat.message"](input, output);

  const syntheticParts = output.parts.filter(p => p.synthetic === true);
  assert.ok(syntheticParts.length > 0, "WAM debe inyectar al menos una parte sintética");

  for (const part of syntheticParts) {
    if (part.type === "text" && part.text) {
      assert.ok(
        part.text.startsWith("[wam] "),
        `Parte sintética debe empezar con "[wam] ", recibió: "${part.text.slice(0, 40)}..."`,
      );
      assert.ok(part.metadata?.wam === true, "Parte sintética debe tener metadata.wam=true");
    }
  }
});

test("no hay texto emitido sin prefijo [wam] en las partes sintéticas del flujo chat.message", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-test-"));

  const plugin = await WaitAMinutePlugin({
    directory: tmpDir,
    debug: true,
    skills: [],
    wamConfig: { enableAll: true },
  });

  const input = {
    sessionID: "test-session-2",
    messageID: "msg-test-2",
    message: { parts: [{ type: "text", text: "otro mensaje" }] }
  };
  const output = { parts: [] };

  await plugin["chat.message"](input, output);

  const syntheticParts = output.parts.filter(p => p.synthetic === true);
  for (const part of syntheticParts) {
    if (part.type === "text" && part.text) {
      assert.ok(
        part.text.startsWith("[wam] "),
        `Todo texto WAM sintético debe empezar con "[wam] ", recibió: "${part.text.slice(0, 40)}..."`,
      );
    }
  }
});