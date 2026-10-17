import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import WaitAMinutePlugin from "./index.js";

test("emitTextPart inyecta prefijo [wam] al frente del texto visible", async () => {
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
    // OpenCode chat.message input shape
    message: {
      parts: [
        { type: "text", text: "Hola mundo" }
      ]
    }
  };
  // OpenCode chat.message output shape (mutable)
  const output = {
    // The plugin will inject into output.parts or output.system
    parts: [] // start empty, plugin will prepend
  };

  await plugin["chat.message"](input, output);

  const emitted = output.parts.filter((p) => p.type === "text" && p.text);
  assert.ok(emitted.length > 0, "WAM debe inyectar al menos una parte de texto");

  for (const part of emitted) {
    assert.ok(
      part.text.startsWith("[wam] "),
      `Parte debe empezar con "[wam] ", recibió: "${part.text.slice(0, 40)}..."`,
    );
    assert.ok(part.synthetic === true, "Parte debe estar marcada como synthetic");
    assert.ok(part.metadata?.wam === true, "Parte debe tener metadata.wam=true");
  }
});

test("no hay texto emitido sin prefijo [wam] en el flujo chat.message", async () => {
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

  for (const part of output.parts) {
    if (part.type === "text" && part.text) {
      assert.ok(
        part.text.startsWith("[wam] "),
        `Todo texto WAM debe empezar con "[wam] ", recibió: "${part.text.slice(0, 40)}..."`,
      );
    }
  }
});