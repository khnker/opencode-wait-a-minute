import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { startExperiment, noteSuccess } from "../src/execution/execution-engine.js";
import { evaluateCompletion } from "../src/verification/completion-gate-simple.js";
import { getTaskState } from "../src/skills/engine.js";

test("E2E: Evidencia insuficiente emite aviso advisory en VERIFYING (no bloquea DONE)", async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "wam-evidence-fail-"));
  const taskId = "evidence-fail-task";
  const taskDir = path.join(TMP, ".wam", "tasks", taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  
  const initialState = {
    requirements: [{ id: "req-1", title: "Test genérico", status: "done", evidence: [] }],
    contract: { status: "APPROVED", requirements: ["Test genérico"], checks: [] }
  };
  fs.writeFileSync(path.join(taskDir, "state.yaml"), JSON.stringify(initialState));

  try {
    const { hypothesis, experiment } = await startExperiment(TMP, taskId, {
      statement: "Generar reporte",
      tool: "write",
      args: { path: "report.md", content: "# OK" },
      expectedObservation: { status: "written" }
    });
    // Note: Sin evidenceID válido, el requisito queda en "done" pero no "verified"
    await noteSuccess(TMP, taskId, {
      hypothesisId: hypothesis.id,
      experimentId: experiment.id,
      result: "report.md written",
      actual: { path: "report.md" },
      unexpected: {},
      provenance: "agent-tool-write"
    });
    // El completion gate es advisory: señala lo no verificado, nunca bloquea.
    const state = getTaskState(taskId, TMP);
    const gate = evaluateCompletion(state);
    assert.equal(gate.blocked, false, "el gate nunca bloquea el DONE");
    assert.equal(gate.advisory, true, "el gate emite aviso advisory");
    assert.ok(
      gate.unresolvedRequirements.length > 0,
      "el aviso incluye los requisitos sin verificar",
    );
    assert.match(gate.recommendation, /^Recomendación:/, "el aviso es una recomendación");
    assert.doesNotMatch(gate.recommendation, /⛔|No declares DONE/, "sin directiva de bloqueo");
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
