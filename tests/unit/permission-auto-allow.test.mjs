import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pluginDefault from "../../index.js";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wam-permission-auto-allow-"));
process.chdir(directory);

const tick = () => new Promise((resolve) => setImmediate(resolve));

const hooksFor = (client) => pluginDefault({ directory, client, project: {}, $: {} });

test("permission.asked replies always through client.permission.reply", async () => {
  const calls = [];
  const hooks = await hooksFor({
    permission: {
      reply: async (args) => {
        calls.push(args);
        return { data: true };
      },
    },
  });

  hooks.event({ event: { type: "permission.asked", properties: { id: "per_1", sessionID: "ses_1" } } });
  await tick();

  assert.deepEqual(calls, [{ requestID: "per_1", reply: "always" }]);
});

test("permission.v2.asked falls back to the session permission endpoint", async () => {
  const calls = [];
  const hooks = await hooksFor({
    session: {
      permission: {
        reply: async (args) => {
          calls.push(args);
          return { data: true };
        },
      },
    },
  });

  hooks.event({ event: { type: "permission.v2.asked", properties: { id: "per_2", sessionID: "ses_2" } } });
  await tick();

  assert.deepEqual(calls, [{ sessionID: "ses_2", requestID: "per_2", reply: "always" }]);
});

test("permission.asked uses the OpenCode v1 client method when present", async () => {
  const calls = [];
  const hooks = await hooksFor({
    postSessionIdPermissionsPermissionId: async (args) => {
      calls.push(args);
      return { data: true };
    },
  });

  hooks.event({ event: { type: "permission.asked", properties: { id: "per_legacy", sessionID: "ses_legacy" } } });
  await tick();

  assert.deepEqual(calls, [
    {
      path: { id: "ses_legacy", permissionID: "per_legacy" },
      body: { response: "always" },
    },
  ]);
});

test("a failed legacy reply falls through to the session endpoint", async () => {
  const calls = [];
  const hooks = await hooksFor({
    permission: {
      reply: async () => ({ error: { message: "not found" } }),
    },
    session: {
      permission: {
        reply: async (args) => {
          calls.push(args);
          return { data: true };
        },
      },
    },
  });

  hooks.event({ event: { type: "permission.asked", properties: { id: "per_3", sessionID: "ses_3" } } });
  await tick();

  assert.deepEqual(calls, [{ sessionID: "ses_3", requestID: "per_3", reply: "always" }]);
});

test("an unrelated event does not reply to a permission", async () => {
  const calls = [];
  const hooks = await hooksFor({
    permission: {
      reply: async (args) => {
        calls.push(args);
        return { data: true };
      },
    },
  });

  hooks.event({ event: { type: "session.idle", properties: { sessionID: "ses_4" } } });
  await tick();

  assert.deepEqual(calls, []);
});

test("permission.asked without a request id does not throw or reply", async () => {
  const calls = [];
  const hooks = await hooksFor({
    permission: {
      reply: async (args) => {
        calls.push(args);
        return { data: true };
      },
    },
  });

  assert.doesNotThrow(() => hooks.event({ event: { type: "permission.asked", properties: { sessionID: "ses_5" } } }));
  await tick();

  assert.deepEqual(calls, []);
});
