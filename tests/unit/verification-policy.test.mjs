import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  VERIFICATION_STRATEGY,
  selectMinimalVerification,
  evaluateCompletionGate,
  confirmCompletion,
} from "../../src/verification/verification-policy.js";
import { detectEvidenceGaps } from "../../src/evidence/evidence-gap.js";
import { createEvidence, EVIDENCE_STRENGTH } from "../../src/evidence/evidence.js";

describe("selectMinimalVerification", () => {
  it("prefere existing_test cuando existe test disponible", () => {
    const gap = { requirementId: "req-1" };
    const checks = [
      { type: "test", value: "run: npm test" },
      { type: "command", value: "curl localhost:3000" },
    ];

    const result = selectMinimalVerification(gap, checks);

    assert.equal(result.strategy, VERIFICATION_STRATEGY.EXISTING_TEST);
    assert.equal(result.check.type, "test");
  });

  it("prefiere targeted_command sobre targeted_inspection", () => {
    const gap = { requirementId: "req-1" };
    const checks = [
      { type: "command", value: "npm run build" },
      { type: "inspection", value: "review logs" },
    ];

    const result = selectMinimalVerification(gap, checks);

    assert.equal(result.strategy, VERIFICATION_STRATEGY.TARGETED_COMMAND);
    assert.equal(result.check.type, "command");
  });

  it("prefiere targeted_inspection sobre broader_test", () => {
    const gap = { requirementId: "req-1" };
    const checks = [
      { type: "inspection", value: "review config" },
      { type: "broader_test", value: "run full suite" },
    ];

    const result = selectMinimalVerification(gap, checks);

    assert.equal(result.strategy, VERIFICATION_STRATEGY.TARGETED_INSPECTION);
    assert.equal(result.check.type, "inspection");
  });

  it("prefiere broader_test sobre manual_validation", () => {
    const gap = { requirementId: "req-1" };
    const checks = [
      { type: "broader_test", value: "run all tests" },
    ];

    const result = selectMinimalVerification(gap, checks);

    assert.equal(result.strategy, VERIFICATION_STRATEGY.BROADER_TEST);
    assert.equal(result.check.type, "broader_test");
  });

  it("retorna manual_validation cuando no hay checks disponibles", () => {
    const gap = { requirementId: "req-1" };

    const result = selectMinimalVerification(gap, []);

    assert.equal(result.strategy, VERIFICATION_STRATEGY.MANUAL_VALIDATION);
    assert.equal(result.check, null);
  });

  it("respeta el orden: test > command > inspection > broader_test > manual", () => {
    const gap = { requirementId: "req-1" };
    const checks = [
      { type: "broader_test", value: "full suite" },
      { type: "test", value: "unit test" },
      { type: "manual", value: "manual check" },
      { type: "command", value: "npm test" },
      { type: "inspection", value: "review code" },
    ];

    const result = selectMinimalVerification(gap, checks);

    assert.equal(result.strategy, VERIFICATION_STRATEGY.EXISTING_TEST);
    assert.equal(result.check.type, "test");
  });
});

describe("evaluateCompletionGate", () => {
  it("bloquea cuando hay requirements no verificados", () => {
    const task = {
      requirements: [
        { id: "req-1", optional: false, status: "VERIFIED" },
        { id: "req-2", optional: false, status: "PENDING" },
      ],
      evidence: [],
    };

    const result = evaluateCompletionGate(task);

    assert.equal(result.blocked, true);
    assert.equal(result.completedRequirements, 1);
    assert.equal(result.totalRequirements, 2);
  });

  it("bloquea cuando hay evidence gaps", () => {
    const task = {
      requirements: [
        { id: "req-1", optional: false, status: "VERIFIED", claim: "debe funcionar" },
      ],
      evidence: [],
    };

    const result = evaluateCompletionGate(task);

    assert.equal(result.blocked, true);
    assert.ok(result.evidenceGaps.length > 0);
    assert.ok(result.unresolvedRequirements.includes("req-1"));
  });

  it("permite el paso cuando todos los requisitos obligatorios están verificados sin gaps", () => {
    const task = {
      requirements: [
        { id: "req-1", optional: false, status: "VERIFIED", claim: "debe funcionar", critical: true },
      ],
      evidence: [
        createEvidence({
          requirementId: "req-1",
          source: "test",
          type: "DIRECT",
          observation: "observación directa",
          strength: EVIDENCE_STRENGTH.L3_DIRECT,
        }),
      ],
    };

    const result = evaluateCompletionGate(task);

    assert.equal(result.blocked, false);
    assert.equal(result.completedRequirements, 1);
    assert.equal(result.totalRequirements, 1);
    assert.equal(result.evidenceGaps.length, 0);
    assert.deepEqual(result.unresolvedRequirements, []);
  });

  it("ignora requisitos opcionales en el conteo", () => {
    const task = {
      requirements: [
        { id: "req-1", optional: false, status: "VERIFIED", claim: "debe funcionar", critical: true },
        { id: "req-2", optional: true, status: "PENDING" },
      ],
      evidence: [
        createEvidence({
          requirementId: "req-1",
          source: "test",
          type: "DIRECT",
          observation: "verificado",
          strength: EVIDENCE_STRENGTH.L3_DIRECT,
        }),
        createEvidence({
          requirementId: "req-2",
          source: "test",
          type: "DIRECT",
          observation: "opcional verificado",
          strength: EVIDENCE_STRENGTH.L3_DIRECT,
        }),
      ],
    };

    const result = evaluateCompletionGate(task);

    assert.equal(result.totalRequirements, 1);
    assert.equal(result.completedRequirements, 1);
    assert.equal(result.blocked, false);
  });

  it("bloquea si hay gap de fuerza de evidencia en requisito obligatorio sin evidencia", () => {
    const task = {
      requirements: [
        { id: "req-1", optional: false, status: "VERIFIED", claim: "crítico", critical: true },
      ],
      evidence: [],
    };

    const result = evaluateCompletionGate(task);

    assert.equal(result.blocked, true);
    assert.ok(result.evidenceGaps.length > 0);
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("confirmCompletion", () => {
  it("imprime el resumen de token savings cuando DONE está confirmado y projectRoot presente", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-confirm-"));
    const metricsDir = path.join(tmp, ".wam", "metrics");
    const prevMetricsDir = process.env.WAM_METRICS_DIR;
    process.env.WAM_METRICS_DIR = metricsDir;
    fs.mkdirSync(metricsDir, { recursive: true });
    fs.writeFileSync(
      path.join(metricsDir, "token-savings.json"),
      JSON.stringify([
        {
          taskId: "final-task",
          timestamp: Date.now(),
          claimable: true,
          usageSource: "provider",
          actualTokens: 50,
          baselineTokens: 5000,
          savingsPct: 99,
          savingsTokens: 4950,
        },
      ])
    );

    const task = {
      requirements: [{ id: "req-1", optional: false, status: "VERIFIED" }],
      evidence: [
        createEvidence({
          requirementId: "req-1",
          source: "test",
          type: "DIRECT",
          observation: "ok",
          strength: EVIDENCE_STRENGTH.L3_DIRECT,
        }),
      ],
    };

    const captured = [];
    try {
      const result = confirmCompletion(task, {
        projectRoot: tmp,
        logger: { log: (line) => captured.push(line) },
      });

      fs.rmSync(tmp, { recursive: true, force: true });

      assert.equal(result.blocked, false);
      assert.equal(captured.length, 1);
      assert.equal(
        captured[0],
        "[WAM Token Savings] Task final-task saved 99% tokens: 4950 tokens saved vs measured baseline (provider usage)"
      );
    } finally {
      if (prevMetricsDir === undefined) delete process.env.WAM_METRICS_DIR;
      else process.env.WAM_METRICS_DIR = prevMetricsDir;
    }
  });

  it("no imprime nada cuando la tarea sigue bloqueada", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-confirm-"));
    const metricsDir = path.join(tmp, ".wam", "metrics");
    fs.mkdirSync(metricsDir, { recursive: true });
    fs.writeFileSync(
      path.join(metricsDir, "token-savings.json"),
      JSON.stringify([
        { taskId: "x", timestamp: 1, actualTokens: 1, baselineTokens: 100, savingsPct: 99, savingsTokens: 99 },
      ])
    );

    const task = {
      requirements: [{ id: "req-1", optional: false, status: "PENDING" }],
      evidence: [],
    };

    const captured = [];
    const result = confirmCompletion(task, {
      projectRoot: tmp,
      logger: { log: (line) => captured.push(line) },
    });

    fs.rmSync(tmp, { recursive: true, force: true });

    assert.equal(result.blocked, true);
    assert.equal(captured.length, 0);
  });

  it("funciona sin projectRoot (DONE confirmado sin imprimir nada)", () => {
    const task = {
      requirements: [{ id: "req-1", optional: false, status: "VERIFIED" }],
      evidence: [
        createEvidence({
          requirementId: "req-1",
          source: "test",
          type: "DIRECT",
          observation: "ok",
          strength: EVIDENCE_STRENGTH.L3_DIRECT,
        }),
      ],
    };

    const result = confirmCompletion(task);
    assert.equal(result.blocked, false);
  });
});
