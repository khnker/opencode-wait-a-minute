import { test } from "node:test";
import assert from "node:assert";
import {
  detectCouplingIntent,
  traceCouplingForTask,
} from "../../../src/context/selection.js";

test("detectCouplingIntent identifies intent", () => {
  assert.strictEqual(detectCouplingIntent("trace coupling for /api/user"), true);
  assert.strictEqual(detectCouplingIntent("analyze cross-layer path in src/utils.js"), true);
});

test("detectCouplingIntent avoids false positives", () => {
  assert.strictEqual(detectCouplingIntent("please check the coupling mechanism inside src/utils.js"), false);
  assert.strictEqual(detectCouplingIntent("hello world"), false);
});

test("traceCouplingForTask is best-effort: bad/empty input returns { ok:false }", async () => {
  const res = await traceCouplingForTask("test", { root: "/tmp" });
  assert.strictEqual(res.ok, false);
});

test("traceCouplingForTask returns a bounded compact summary for a valid start", async () => {
  try {
      const res = await traceCouplingForTask("trace coupling in package.json", { root: process.cwd() });
      console.log("Res:", res);
      assert.strictEqual(res.ok, true);
      assert.ok(Array.isArray(res.lines));
  } catch(e) {
      console.error(e);
      throw e;
  }
});
