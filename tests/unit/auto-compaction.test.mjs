import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import pluginDefault from "../../index.js";

test("event hook triggers session.summarize above the token threshold", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-auto-compact-"));
  const calls = [];
  const client = {
    session: {
      get: async () => ({ location: { directory: root } }),
      summarize: async (args) => {
        calls.push(args);
        return true;
      },
    },
  };
  const prevThreshold = process.env.WAM_AUTO_COMPACT_TOKENS;
  const prevCooldown = process.env.WAM_AUTO_COMPACT_COOLDOWN_MS;
  process.env.WAM_AUTO_COMPACT_TOKENS = "100000";
  process.env.WAM_AUTO_COMPACT_COOLDOWN_MS = "0";

  try {
    const hooks = await pluginDefault({ directory: root, client, project: {}, $: {} });
    const info = {
      id: "m1",
      role: "assistant",
      sessionID: "s1",
      providerID: "provider",
      modelID: "model",
      finish: "stop",
      time: { completed: Date.now() },
      tokens: { input: 60000, output: 50000, cache: { read: 0, write: 0 } },
    };
    await hooks.event({ event: { type: "message.updated", properties: { info } } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path.id, "s1");
    assert.equal(calls[0].body.providerID, "provider");

    // Summary messages must not trigger compaction again.
    await hooks.event({
      event: { type: "message.updated", properties: { info: { ...info, summary: true } } },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(calls.length, 1);
  } finally {
    if (prevThreshold === undefined) delete process.env.WAM_AUTO_COMPACT_TOKENS;
    else process.env.WAM_AUTO_COMPACT_TOKENS = prevThreshold;
    if (prevCooldown === undefined) delete process.env.WAM_AUTO_COMPACT_COOLDOWN_MS;
    else process.env.WAM_AUTO_COMPACT_COOLDOWN_MS = prevCooldown;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
