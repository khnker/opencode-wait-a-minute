const WaitAMinutePlugin = require('../index.js'); // Adjust if needed
// Actually, we are in a .mjs environment, so let's use import.
// But for quick test, we can use a small node script.

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import WaitAMinutePlugin from "../index.js";

(async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-test-"));
  const plugin = await WaitAMinutePlugin({ directory: tmpDir, debug: true });
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
  const output = { message: { id: "out-test", parts: [] } };
  await plugin["chat.message"](input, output);
  console.log("Emitted parts:", output.message.parts.map(p => p.text));
})();