import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { retrieveContextWithCqe } from "../../src/context/context.js";

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-ctx-get-cqe-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("ctx get falls back to CQE file index when no capsules exist", async (t) => {
  const root = makeTempDir(t);
  fs.writeFileSync(path.join(root, "subtract.js"), "export const CQE_CTX_UNIQUE_TOKEN = 1;\n");

  const r = await retrieveContextWithCqe("CQE_CTX_UNIQUE_TOKEN", { root });

  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.items));
  assert.ok(r.items.some((it) => String(it.path).endsWith("subtract.js")), JSON.stringify(r.items));
  assert.ok(r.source);
});

test("ctx get does not fabricate context when capsules and CQE are empty", async (t) => {
  const root = makeTempDir(t);

  const r = await retrieveContextWithCqe("zzz_no_such_token_zzz", { root });

  assert.equal(r.ok, false);
  assert.equal(typeof r.message, "string");
  assert.ok(!r.items || r.items.length === 0);
});
