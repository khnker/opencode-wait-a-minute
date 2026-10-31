import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import WaitAMinutePlugin from "../../index.js";

test("WAM chat visibility: notices are synthetic and never replace the user text", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-visibility-"));
  const plugin = await WaitAMinutePlugin({ directory: tmpDir, debug: true });

  const userText = "Crea una calculadora en React con TypeScript";
  const input = {
    sessionID: "ses-visibility-test",
    messageID: "msg-vis-1",
    message: {
      id: "msg-vis-1",
      parts: [{ type: "text", text: userText }],
    },
  };

  const output = {
    parts: [{ id: "prt_user", type: "text", text: userText }],
  };

  await plugin["chat.message"](input, output);

  assert.ok(output.parts.length > 1, "Debe inyectar partes en output.parts");

  const interventionPart = output.parts.find((p) => p.text && p.text.includes("[wam]"));
  assert.ok(interventionPart, "Debe contener el aviso sintético de WAM");
  assert.doesNotMatch(interventionPart.text, /Intervención activa/, "ya no hay gate de intervención");
  assert.strictEqual(interventionPart.synthetic, true, "Los avisos de WAM deben ser synthetic");
  assert.strictEqual(interventionPart.metadata.wam, true, "Debe tener metadata.wam = true");

  const nonSynthetic = output.parts.filter((p) => p.type === "text" && p.synthetic !== true);
  assert.deepStrictEqual(
    nonSynthetic.map((p) => p.text),
    [userText],
    "El texto del usuario debe ser la única parte no sintética",
  );

  console.log("PASS: WAM chat visibility test verified successfully.");
});

test("WAM chat visibility: /wam command replies stay visible", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-visibility-cmd-"));
  const plugin = await WaitAMinutePlugin({ directory: tmpDir, debug: true });

  const output = { parts: [], message: {} };
  await plugin["command.execute.before"](
    { command: "wam", sessionID: "ses-visibility-cmd", arguments: ["status"] },
    output,
  );

  const reply = output.parts.find((p) => p.type === "text");
  assert.ok(reply, "el comando debe responder");
  assert.strictEqual(reply.synthetic, false, "la respuesta a /wam debe verse");
});
