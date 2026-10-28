import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import pluginDefault from "../../index.js";

test("tool.execute.after reduces large output and compaction hook injects brief", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-curation-int-"));
  const hooks = await pluginDefault({ directory: root, client: {}, project: {}, $: {} });
  const sessionID = "curation-int";
  await hooks["chat.message"](
    {
      sessionID,
      messageID: "m1",
      message: { parts: [{ type: "text", text: "implementa un endpoint OAuth2 con tests" }] },
      taskId: "curation-task",
    },
    { message: {}, parts: [] }
  );

  const big = "tool output line\n".repeat(3000);
  const toolOut = { output: big };
  await hooks["tool.execute.after"]({ sessionID, tool: "bash", callID: "c1" }, toolOut);
  assert.ok(toolOut.output.length < big.length, "tool output must be reduced");
  assert.ok(toolOut.output.includes("[raw output:"), "raw reference present");

  const compactionOut = { context: [] };
  await hooks["experimental.session.compacting"]({ sessionID }, compactionOut);
  assert.ok(compactionOut.context.length > 0, "brief injected");
  assert.match(compactionOut.context.join("\n"), /\[wam context brief\]/);

  fs.rmSync(root, { recursive: true, force: true });
});
