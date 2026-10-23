import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import WaitAMinutePlugin from "../../index.js";

test("WAM chat visibility: chat.message injects visible intervention notice and skills", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-visibility-"));
  const plugin = await WaitAMinutePlugin({ directory: tmpDir, debug: true });

  const input = {
    sessionID: "ses-visibility-test",
    messageID: "msg-vis-1",
    message: {
      id: "msg-vis-1",
      parts: [
        { type: "text", text: "Crea una calculadora en React con TypeScript" }
      ]
    }
  };

  const output = {
    parts: []
  };

  await plugin["chat.message"](input, output);

  assert.ok(output.parts.length > 0, "Debe inyectar partes en output.parts");
  
  const interventionPart = output.parts.find(p => p.text && p.text.includes("Intervención activa"));
  assert.ok(interventionPart, "Debe contener el aviso de Intervención activa");
  assert.strictEqual(interventionPart.synthetic, false, "El flag synthetic debe ser false para ser visible en el chat");
  assert.strictEqual(interventionPart.metadata.wam, true, "Debe tener metadata.wam = true");

  console.log("PASS: WAM chat visibility test verified successfully.");
});
