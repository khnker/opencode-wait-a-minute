#!/usr/bin/env node
/**
 * E2E autonomous-loop (targeted) — the exact acceptance path the audit left open:
 *
 *   brand-new prompt
 *     -> automatic task classification + requirement derivation (no explicit /wam loop)
 *     -> automatic advisory skill routing
 *     -> model claims DONE while requirements are still unverified
 *     -> post-DONE gate stays closed and the auto-loop re-drives with a synthetic
 *        [wam auto-loop] directive
 *     -> once every requirement is VERIFIED with evidence the gate opens and the
 *        auto-loop stops.
 *
 * This complements tests/e2e/lifecycle/run.mjs by asserting the re-drive decision
 * (planAutoContinuation/buildAutoLoopPrompt) rather than only canComplete().
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { synthesizeContract, routeSkillsV2 } from "../../../src/skills/engine.js";
import {
  createEvidence,
  transitionVerification,
  isVerified,
} from "../../../src/verification/verification-lifecycle.js";
import { canComplete } from "../../../src/verification/verification-lifecycle.js";
import {
  planAutoContinuation,
  buildAutoLoopPrompt,
} from "../../../src/execution/auto-continuation.js";

const PENDING_PROMPT =
  "Implementa el refresh de tokens en src/auth/token.ts y agrega tests";

function stateFromContract(contract) {
  return {
    taskId: "task-auto-loop-targeted",
    status: "active",
    phase: "IMPLEMENTING",
    requirements: contract.requirements.map((title, i) => ({
      id: `req-${i + 1}`,
      title: typeof title === "string" ? title : title.title || `req-${i + 1}`,
      status: "pending",
      verificationStatus: "UNVERIFIED",
      evidence: [],
      optional: false,
    })),
  };
}

test("new prompt auto-enters the loop, routes skills, re-drives on false DONE, and stops once verified", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-auto-loop-"));
  try {
    // 1. Brand-new prompt: automatic classification, no explicit loop command.
    const contract = synthesizeContract(PENDING_PROMPT, "NORMAL");
    assert.equal(contract.status, "PROPOSED", "contract derived automatically from the prompt");
    assert.ok(
      Array.isArray(contract.requirements) && contract.requirements.length > 0,
      "prompt yields at least one requirement without being told to loop",
    );

    // 2. Automatic skill selection (advisory) runs for the same prompt.
    const routing = routeSkillsV2(
      PENDING_PROMPT,
      { projectPath: tmp, root: tmp },
      {},
      "NORMAL",
    );
    assert.ok(routing && typeof routing === "object", "skill routing emitted automatically");
    assert.ok(
      Array.isArray(routing.selected),
      "routing reports selected skills (advisory selection)",
    );

    // 3. Model claims DONE while requirements are unverified.
    const state = stateFromContract(contract);
    const closed = canComplete(state);
    assert.equal(closed.canComplete, false, "gate rejects DONE before verification (fail-closed)");

    const pending = state.requirements.map((r) => `${r.id} ${r.title} unverified`);
    const redrive = planAutoContinuation({
      state: { ...state, autoLoop: undefined },
      gate: { blocked: false, advisory: true, pending },
      assistantText: "DONE",
      messageID: "msg-done-1",
    });
    assert.equal(redrive.continue, true, "false DONE is re-driven automatically");
    assert.equal(redrive.reason, "continue");
    assert.match(redrive.prompt, /\[wam auto-loop\]/, "re-drive carries WAM attribution");

    const payload = buildAutoLoopPrompt(redrive);
    assert.equal(payload.parts[0].synthetic, true, "re-drive part is synthetic, not a user message");

    // 4. Evidence-backed verification opens the gate and stops the loop.
    for (const req of state.requirements) {
      req.verificationStatus = transitionVerification(req.verificationStatus, "VERIFYING");
      req.verificationStatus = transitionVerification(req.verificationStatus, "VERIFIED");
      req.evidence.push(
        createEvidence("test", "pass", "node --test tests/e2e/auto-loop/run.mjs"),
      );
      assert.equal(isVerified(req), true, `${req.id} VERIFIED with evidence`);
    }

    const open = canComplete(state);
    assert.equal(open.canComplete, true, "gate opens only after every requirement is VERIFIED");

    const noRedrive = planAutoContinuation({
      state: { ...state, autoLoop: redrive.nextAutoLoop },
      gate: { blocked: false, advisory: false, pending: [] },
      assistantText: "DONE",
      messageID: "msg-done-2",
    });
    assert.equal(noRedrive.continue, false, "no pending work means no re-drive");
    assert.equal(noRedrive.reason, "gate-open");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
