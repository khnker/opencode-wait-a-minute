#!/usr/bin/env node
/**
 * E2E lifecycle (RC1-02) — a SINGLE unified prompt→done run that asserts every
 * stage of the WAM lifecycle emits its observable signal.
 *
 * Unlike the per-stage unit suites, this test drives ONE prompt through the
 * real plugin modules in order and records the artifact each stage produces:
 *
 *   1. prompt         → raw prompt is the lifecycle input
 *   2. classification → synthesizeContract(prompt) derives a PROPOSED contract
 *   3. context        → selectContext(prompt) builds a context package
 *   4. routing        → routeSkillsV2(prompt) routes skills for the task
 *   5. execution      → startExperiment()/noteSuccess() persist hypothesis +
 *                       experiment + observation in the task store
 *   6. completion     → createEvidence()+transitionVerification()+canComplete()
 *                       close the gate and the task reaches `done`
 *
 * Grounding: modules/exports are the real ones used by index.js and the
 * `tests/unit/*-e2e.test.mjs` suites (no invented hooks or output strings).
 *
 * Run: node --test tests/e2e/lifecycle/run.mjs
 * Exit 0 on success, non-zero on failure.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  synthesizeContract,
  routeSkillsV2,
  persistTaskState,
  getTaskState,
} from "../../../src/skills/engine.js";
import { selectContext } from "../../../src/context/context.js";
import {
  startExperiment,
  noteSuccess,
} from "../../../src/execution/execution-engine.js";
import { listObservations } from "../../../src/cognition/cognition-store.js";
import {
  createEvidence,
  transitionVerification,
  isVerified,
  canComplete,
} from "../../../src/verification/verification-lifecycle.js";

const STAGES = [
  "prompt",
  "classification",
  "context",
  "routing",
  "execution",
  "completion",
];

test("E2E lifecycle: prompt → classification → context → routing → execution → completion", async () => {
  const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "wam-lifecycle-"));
  const taskId = `lifecycle-${Date.now()}`;
  const prompt = "Implement token refresh endpoint and add tests";
  const signals = [];

  try {
    // ── 1. PROMPT ──────────────────────────────────────────────
    assert.equal(typeof prompt, "string");
    assert.ok(prompt.length > 0, "prompt is the lifecycle input");
    signals.push("prompt");

    // ── 2. CLASSIFICATION ──────────────────────────────────────
    // synthesizeContract consumes the prompt and derives the task contract.
    const contract = synthesizeContract(prompt, "NORMAL");
    assert.equal(contract.status, "PROPOSED", "contract derived from prompt");
    assert.equal(contract.rigor, "NORMAL", "rigor reflects the mode");
    assert.ok(
      Array.isArray(contract.requirements) && contract.requirements.length > 0,
      "classification yields at least one requirement",
    );

    // Persist the classified task so later stages can observe it.
    const state = {
      taskId,
      status: "active",
      requirements: contract.requirements.map((title, i) => ({
        id: `req-${i + 1}`,
        title: typeof title === "string" ? title : title.title || `req-${i + 1}`,
        status: "pending",
        verificationStatus: "UNVERIFIED",
        evidence: [],
      })),
    };
    persistTaskState(taskId, state, ROOT);
    assert.ok(getTaskState(taskId, ROOT), "classified task persisted to state");
    signals.push("classification");

    // ── 3. CONTEXT ─────────────────────────────────────────────
    const contextPack = selectContext(prompt, {
      root: ROOT,
      budget: 8000,
      log: false,
    });
    assert.ok(contextPack && typeof contextPack === "object", "context package built");
    assert.ok(
      Array.isArray(contextPack.selected_ids) &&
        typeof contextPack.sufficiency === "string",
      "context selection emitted (selected_ids + sufficiency)",
    );
    signals.push("context");

    // ── 4. ROUTING ─────────────────────────────────────────────
    const routing = routeSkillsV2(
      prompt,
      { projectPath: ROOT, root: ROOT },
      {},
      "NORMAL",
    );
    assert.ok(routing && typeof routing === "object", "skill routing emitted");
    signals.push("routing");

    // ── 5. EXECUTION ───────────────────────────────────────────
    const { hypothesis, experiment } = await startExperiment(ROOT, taskId, {
      statement: "Implement token refresh via edit tool",
      tool: "edit",
      args: { path: "src/auth/token.ts" },
      expectedObservation: { type: "text", pattern: "Success" },
    });
    assert.ok(hypothesis?.id, "hypothesis created");
    assert.ok(experiment?.id, "experiment created");

    noteSuccess(ROOT, taskId, {
      hypothesisId: hypothesis.id,
      experimentId: experiment.id,
      result: "token refresh implemented",
      provenance: "agent-tool-edit",
    });
    const observations = listObservations(ROOT, taskId);
    assert.ok(
      Array.isArray(observations) && observations.length > 0,
      "observation recorded for the task",
    );
    signals.push("execution");

    // ── 6. COMPLETION ──────────────────────────────────────────
    // Fail-closed: the gate must reject while requirements are unverified.
    assert.equal(
      canComplete(state).canComplete,
      false,
      "completion gate stays closed before verification",
    );

    for (const req of state.requirements) {
      req.verificationStatus = transitionVerification(req.verificationStatus, "VERIFYING");
      req.verificationStatus = transitionVerification(req.verificationStatus, "VERIFIED");
      req.evidence.push(
        createEvidence("test", "pass", "node --test tests/e2e/lifecycle/run.mjs"),
      );
      assert.equal(isVerified(req), true, `requirement ${req.id} verified with evidence`);
    }

    const gate = canComplete(state);
    assert.equal(gate.canComplete, true, "completion gate opens once verified");

    state.status = "done";
    persistTaskState(taskId, state, ROOT);
    const reloaded = getTaskState(taskId, ROOT);
    assert.equal(reloaded.status, "done", "task finished");
    assert.equal(
      canComplete(reloaded).canComplete,
      true,
      "final state consistent after reload",
    );
    signals.push("completion");

    // ── Unified assertion: every stage emitted its signal, in order ──
    assert.deepEqual(signals, STAGES, "all lifecycle stages emitted their signal");
  } finally {
    fs.rmSync(ROOT, { recursive: true, force: true });
  }
});
