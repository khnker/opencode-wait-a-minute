import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { nextActionFrom } from "../../src/state/next-action.js";
import { assembleContext } from "../../src/context/assembly.js";

test("nextActionFrom reports completion when every requirement is verified with evidence", () => {
  const state = {
    requirements: [
      { id: "req-1", title: "One", status: "verified", evidence: ["x"] },
      { id: "req-2", title: "Two", status: "verified", evidence: ["y"] },
    ],
  };
  assert.equal(nextActionFrom(state), "Tarea completa — contrato verificado");
});

test("nextActionFrom still points at done-without-evidence requirements", () => {
  const state = {
    requirements: [{ id: "req-1", title: "One", status: "done", evidence: [] }],
  };
  assert.match(nextActionFrom(state), /^Verificar One/);
});

test("N2 task line recomputes nextAction instead of trusting stale state", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-n2-"));
  const taskId = "task-n2";
  fs.mkdirSync(path.join(root, ".wam", "tasks", taskId), { recursive: true });
  try {
    const taskState = {
      phase: "IMPLEMENTING",
      contract: { status: "APPROVED" },
      requirements: [
        { id: "req-1", title: "One", status: "verified", evidence: ["x"] },
      ],
      nextAction: "Verificar requisitos completos antes de DONE",
    };
    const pack = await assembleContext({
      prompt: "anything",
      taskId,
      projectPath: root,
      budget: 8000,
      taskState,
    });
    const text = pack.lines.join("\n");
    assert.match(text, /\[wam N2 task\]/);
    assert.match(text, /Tarea completa — contrato verificado/);
    assert.doesNotMatch(text, /Verificar requisitos completos antes de DONE/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
