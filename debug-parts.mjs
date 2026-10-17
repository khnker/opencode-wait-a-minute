import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import WaitAMinutePlugin from "./index.js";

test("debug parts", async () => {
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

  console.log("Number of parts:", output.parts.length);
  output.parts.forEach((p, i) => {
    console.log(`Part ${i}:`, {
      type: p.type,
      text: p.text && p.text.substring(0, 50),
      synthetic: p.synthetic,
      metadata: p.metadata
    });
  });
});