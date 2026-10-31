import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import pluginDefault from "../../index.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-bypass-"));
const hooks = await pluginDefault({ directory: root, client: {}, project: {}, $: {} });

const wam = async (args, sid) => {
  const out = { parts: [], message: {} };
  await hooks["command.execute.before"](
    { command: "wam", sessionID: sid, arguments: args },
    out
  );
  return out.parts.map((p) => p.text).join("\n");
};

let seq = 0;
const send = async (sid, text) => {
  const id = `msg-${sid}-${++seq}`;
  const out = { message: { id }, parts: [] };
  await hooks["chat.message"](
    { sessionID: sid, messageID: id, message: { parts: [{ type: "text", text }] } },
    out
  );
  return out;
};

test("chat.message is bypassed after /wam off and restored by /wam on", async () => {
  const sid = "bypass-chat";

  await wam(["off"], sid);
  const off = await send(sid, "Implement an OAuth2 endpoint with token validation");
  assert.equal(off.parts.length, 0, "no WAM parts while the session is off");

  await wam(["on"], sid);
  const on = await send(sid, "Implement an OAuth2 endpoint with token validation");
  assert.ok(on.parts.length > 0, "WAM parts restored after /wam on");
});

test("tool.execute.before is bypassed in ASKING after /wam off", async () => {
  const sid = "bypass-tool";

  await send(sid, "Add support for deleting accounts");
  await hooks["tool.execute.before"]({ sessionID: sid, tool: "write" }, {});

  await wam(["off"], sid);
  await hooks["tool.execute.before"]({ sessionID: sid, tool: "write" }, {});
});

test("tool.execute.after is bypassed after /wam off", async () => {
  const sid = "bypass-after";
  await wam(["off"], sid);
  await hooks["tool.execute.after"](
    { sessionID: sid, tool: "write", callID: "call-1" },
    { error: "boom" }
  );
});

test.after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
