import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assembleContext } from "../../src/context/assembly.js";

test("assembleContext surfaces runtime evidence in its output lines", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-assembly-runtime-"));
  try {
    fs.mkdirSync(path.join(root, ".wam"), { recursive: true });

    const pack = await assembleContext({
      prompt: "unrelated words for the prompt gate",
      taskId: "task-1",
      projectPath: root,
      taskState: {
        taskId: "task-1",
        phase: "IMPLEMENTING",
        contract: { objective: "Persist runtime evidence" },
        requirements: [{ id: "req-1", title: "Persist evidence" }],
      },
      evidenceLineage: [
        {
          id: "evidence-runtime-1",
          requirementId: "req-1",
          content: "Runtime evidence content reaches N3",
          status: "valid",
          createdAt: 1,
        },
      ],
    });

    const output = pack.lines.join("\n");
    assert.ok(
      output.includes("evidence-runtime-1") ||
        output.includes("Runtime evidence content reaches N3"),
      `expected runtime evidence in output, got:\n${output}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
