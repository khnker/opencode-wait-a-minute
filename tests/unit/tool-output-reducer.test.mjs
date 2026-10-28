import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { reduceToolOutput } from "../../src/context/tool-output-reducer.js";

test("large tool output is stored raw and reduced", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-tool-"));
  const big = "line of output\n".repeat(2000);
  const result = reduceToolOutput({ toolName: "bash", text: big, root, taskId: "task-1" });

  assert.equal(result.changed, true);
  assert.ok(result.text.length <= 2400, `reduced length: ${result.text.length}`);
  assert.ok(fs.existsSync(result.rawPath), "raw output stored");
  assert.ok(result.savedTokens > 0, "tokens saved");
  assert.ok(result.text.includes("[raw output:"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("small tool output is unchanged", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-tool-"));
  const result = reduceToolOutput({ toolName: "bash", text: "ok", root, taskId: "task-1" });
  assert.equal(result.changed, false);
  assert.equal(result.text, "ok");
  assert.equal(result.savedTokens, 0);
  fs.rmSync(root, { recursive: true, force: true });
});
