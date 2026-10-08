import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WaitAMinutePlugin from "../../index.js";

test("tool.execute.after hook no lanza ReferenceError (regresión postToolExecution scope)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "wam-after-"));
  const logs = [];
  const origError = console.error;
  const origLog = console.log;
  console.error = (...a) => logs.push(a.join(" "));
  console.log = (...a) => logs.push(a.join(" "));
  try {
    const plugin = await WaitAMinutePlugin({
      directory: dir,
      client: { session: { get: async () => ({ location: { directory: dir } }) } },
    });
    assert.equal(typeof plugin["tool.execute.after"], "function");
    await plugin["tool.execute.after"](
      { sessionID: "ses_test", tool: "bash", callID: "call_1" },
      { result: "ok" },
    );
  } finally {
    console.error = origError;
    console.log = origLog;
    rmSync(dir, { recursive: true, force: true });
  }
  const bad = logs.filter((m) => /is not defined|ReferenceError/.test(m));
  assert.deepEqual(bad, [], `errores de runtime inesperados: ${bad.join(" | ")}`);
});
