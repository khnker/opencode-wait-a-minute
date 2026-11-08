import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import WaitAMinutePlugin from "../../index.js";

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}

test("dashboard does not listen unless WAM_DASHBOARD is enabled", async () => {
  const port = await freePort();
  const previous = {
    dashboard: process.env.WAM_DASHBOARD,
    port: process.env.WAM_DASHBOARD_PORT,
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-dashboard-off-"));
  delete process.env.WAM_DASHBOARD;
  process.env.WAM_DASHBOARD_PORT = String(port);

  try {
    await WaitAMinutePlugin({ directory: dir });
    assert.equal(await canConnect(port), false);
  } finally {
    if (previous.dashboard === undefined) delete process.env.WAM_DASHBOARD;
    else process.env.WAM_DASHBOARD = previous.dashboard;
    if (previous.port === undefined) delete process.env.WAM_DASHBOARD_PORT;
    else process.env.WAM_DASHBOARD_PORT = previous.port;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
