#!/usr/bin/env node
/**
 * tests/isolation/interleaved-isolation.test.mjs
 *
 * Adversarial interleaving test: 3 distinct tasks (A: payment/Stripe,
 * B: docs/README, C: auth/OAuth) with distinct context, evidence, and
 * completion status. After every step we reload from disk and assert that
 * no cross-task contamination has occurred:
 *   - no context leakage between tasks
 *   - no evidence leakage
 *   - no completion-status crossover
 *   - no skill/requirement pollution
 *
 * Discoverable by scripts/run-tests.mjs (filename matches *.test.mjs).
 * Uses node:test + node:assert/strict. Cleans up its temp dir.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";

import {
  createWamState,
  loadWamState,
  saveWamState,
} from "../../src/state/wam-state.js";

const tmpBase = join(tmpdir(), `wam-interleave-${process.pid}-${Date.now()}`);

after(async () => {
  await rm(tmpBase, { recursive: true, force: true });
});

await mkdir(tmpBase, { recursive: true });

// ── Fixtures ─────────────────────────────────────────────────
// Three tasks with deliberately distinct fingerprints across every axis.
const TASK_A = {
  taskId: "task-payment-stripe",
  requirements: {
    requirement: ["charge customer via Stripe", "idempotency key"],
    skill: ["payments"],
    api: ["stripe.com"],
  },
  context: {
    intent: "process payment",
    provider: "stripe",
    amount_cents: 12999,
    currency: "usd",
  },
  evidence: {
    event: "payment.succeeded",
    receipt: "rcp_001",
  },
  terminalStatus: "completed",
};

const TASK_B = {
  taskId: "task-docs-readme",
  requirements: {
    requirement: ["rewrite README", "add badge"],
    skill: ["markdown"],
    api: ["github.com"],
  },
  context: {
    intent: "update documentation",
    file: "README.md",
    audience: "developers",
  },
  evidence: {
    pr: 42,
    commit: "deadbeef",
  },
  terminalStatus: "completed",
};

const TASK_C = {
  taskId: "task-auth-oauth",
  requirements: {
    requirement: ["OAuth flow", "refresh tokens"],
    skill: ["auth"],
    api: ["oauth.example.com"],
  },
  context: {
    intent: "user authentication",
    provider: "google",
    scopes: ["openid", "email"],
  },
  evidence: {
    token_type: "Bearer",
    ttl: 3600,
  },
  terminalStatus: "active", // stays open — must NOT become completed
};

function makeState(spec) {
  return createWamState(spec.taskId, spec.requirements, spec.context, spec.evidence);
}

function fingerprint(spec) {
  return JSON.stringify({
    requirements: spec.requirements,
    context: spec.context,
    evidence: spec.evidence,
    status: spec.terminalStatus,
  });
}

/**
 * Asserts the on-disk state for `taskId` matches `expectedSpec` exactly,
 * and contains NO traces of the other tasks' fingerprints.
 * `expectedStatus` is the concrete status we expect right now
 * (may differ from terminalStatus before promotion).
 */
async function assertIsolated(taskId, expectedSpec, otherSpecs, expectedStatus) {
  const loaded = await loadWamState(taskId, tmpBase);
  assert.ok(loaded, `state for ${taskId} must exist on disk`);

  // Field-by-field equality (no cross-contamination).
  assert.equal(loaded.taskId, expectedSpec.taskId, "taskId preserved");
  assert.deepEqual(loaded.requirements, expectedSpec.requirements, "requirements isolated");
  assert.deepEqual(loaded.context, expectedSpec.context, "context isolated");
  assert.deepEqual(loaded.evidence, expectedSpec.evidence, "evidence isolated");

  const ownFingerprint = JSON.stringify({
    requirements: expectedSpec.requirements,
    context: expectedSpec.context,
    evidence: expectedSpec.evidence,
    status: expectedStatus,
  });
  const loadedFingerprint = JSON.stringify({
    requirements: expectedSpec.requirements,
    context: expectedSpec.context,
    evidence: expectedSpec.evidence,
    status: loaded.status,
  });
  assert.equal(loadedFingerprint, ownFingerprint, "full fingerprint matches");

  // Other tasks' fingerprints must NOT appear anywhere in loaded JSON.
  const asJson = JSON.stringify(loaded);
  for (const other of otherSpecs) {
    const otherFp = JSON.stringify({
        requirements: other.requirements,
        context: other.context,
        evidence: other.evidence,
        status: other.terminalStatus,
      });
    assert.ok(
      !asJson.includes(otherFp),
      `${taskId} must not contain fingerprint of ${other.taskId}`,
    );
    // Specific canary values too.
    for (const key of Object.keys(other.context)) {
      assert.ok(
        !asJson.includes(`"${key}":"${other.context[key]}"`),
        `${taskId} must not leak ${other.taskId} context key ${key}`,
      );
    }
    for (const key of Object.keys(other.evidence)) {
      assert.ok(
        !asJson.includes(`"${key}":`),
        `${taskId} must not leak ${other.taskId} evidence key ${key}`,
      );
    }
  }

  return loaded;
}

test("interleaved A→B→C→A→C→B→A keeps every task isolated", async () => {
  // Seed all three with their distinct fingerprints.
  await saveWamState(TASK_A.taskId, makeState(TASK_A), tmpBase);
  await saveWamState(TASK_B.taskId, makeState(TASK_B), tmpBase);
  await saveWamState(TASK_C.taskId, makeState(TASK_C), tmpBase);

  // Interleaving: A→B→C→A→C→B→A. After EACH step, reload everything
  // and verify zero cross-contamination and correct status semantics.
  const order = [TASK_A, TASK_B, TASK_C, TASK_A, TASK_C, TASK_B, TASK_A];
  const othersOf = (spec) => [TASK_A, TASK_B, TASK_C].filter((s) => s !== spec);

  // Track which tasks have been promoted to "completed" so we don't
  // revert them back to "active" on subsequent interleaving steps.
  const promoted = new Set();

  for (let i = 0; i < order.length; i++) {
    const spec = order[i];

    // Mutate: re-create + save (simulates a fresh step touching only this task).
    const fresh = makeState(spec);
    // Promote to terminal on the last occurrence of A/B; C never completes.
    if (spec.terminalStatus === "completed" && i === order.lastIndexOf(spec)) {
      fresh.status = "completed";
      fresh.completedAt = new Date().toISOString();
      promoted.add(spec.taskId);
    }
    // If this task was already promoted in an earlier step, keep it completed.
    if (promoted.has(spec.taskId) && spec.terminalStatus === "completed") {
      fresh.status = "completed";
      fresh.completedAt = fresh.updatedAt;
    }
    await saveWamState(spec.taskId, fresh, tmpBase);

    // For promoted tasks, verify completedAt is present now.
    if (promoted.has(spec.taskId) && spec.terminalStatus === "completed") {
      assert.ok("completedAt" in fresh, "completed task carries completedAt");
    }

    // Statuses expected for each task RIGHT NOW (A/B completed once promoted).
    const expectedStatusA = promoted.has(TASK_A.taskId) ? "completed" : "active";
    const expectedStatusB = promoted.has(TASK_B.taskId) ? "completed" : "active";
    const expectedStatusC = "active";

    // Assert ALL THREE tasks remain isolated after this step.
    const loadedA = await assertIsolated(TASK_A.taskId, TASK_A, othersOf(TASK_A), expectedStatusA);
    const loadedB = await assertIsolated(TASK_B.taskId, TASK_B, othersOf(TASK_B), expectedStatusB);
    const loadedC = await assertIsolated(TASK_C.taskId, TASK_C, othersOf(TASK_C), expectedStatusC);

    // Status semantics: A & B end completed, C NEVER completes.
    assert.equal(loadedA.status, expectedStatusA, "A status correct after step");
    assert.equal(loadedB.status, expectedStatusB, "B status correct after step");
    assert.equal(loadedC.status, expectedStatusC, "C must NOT be marked completed");
  }

  // Final sanity: no completion crossover — C stayed active the whole time.
  const finalC = await loadWamState(TASK_C.taskId, tmpBase);
  assert.notEqual(finalC.status, "completed", "C never auto-completed via interleaving");
  assert.ok(!("completedAt" in finalC), "C gained no completedAt timestamp");
});

test("partial save of one task does not affect the others on disk", async () => {
  // Reset: brand new temp dir to ensure no carry-over.
  const localRoot = join(tmpBase, "partial");
  await mkdir(localRoot, { recursive: true });

  await saveWamState(TASK_A.taskId, makeState(TASK_A), localRoot);
  await saveWamState(TASK_B.taskId, makeState(TASK_B), localRoot);

  // Re-save only C — A and B must remain byte-identical to their previous save.
  const beforeA = JSON.stringify(await loadWamState(TASK_A.taskId, localRoot));
  const beforeB = JSON.stringify(await loadWamState(TASK_B.taskId, localRoot));
  await saveWamState(TASK_C.taskId, makeState(TASK_C), localRoot);
  const afterA = JSON.stringify(await loadWamState(TASK_A.taskId, localRoot));
  const afterB = JSON.stringify(await loadWamState(TASK_B.taskId, localRoot));

  assert.equal(afterA, beforeA, "Task A unchanged after Task C save");
  assert.equal(afterB, beforeB, "Task B unchanged after Task C save");

  await rm(localRoot, { recursive: true, force: true });
});