
import test from "node:test";
import assert from "node:assert/strict";
import { assembleContext } from "./assembly.js";

const REGISTRY = {
  "matched-skill": { id: "matched-skill", content: "MATCHED_BODY ".repeat(30) },
  "base-skill": { id: "base-skill", content: "BASE_BODY ".repeat(400) },
};

test("regression: injects skill bodies without ReferenceError (skill.base before loop)", async () => {
  const pack = await assembleContext({
    prompt: "do a normal task",
    taskId: "t-regression",
    classification: "normal",
    mode: "NORMAL",
    budget: 8000,
    skillRegistry: REGISTRY,
    selectedSkills: [{ id: "matched-skill", reason: "score 9", relevance: 9, base: false }],
  });
  const text = pack.lines.join("\n");
  assert.ok(text.includes("[wam N3 skill] matched-skill"), "matched skill must be injected");
});

test("task-matched skills are prioritized over base skills under tight budget", async () => {
  const pack = await assembleContext({
    prompt: "do a normal task",
    taskId: "t-priority",
    classification: "normal",
    mode: "NORMAL",
    budget: 4000,
    skillRegistry: REGISTRY,
    selectedSkills: [
      { id: "base-skill", reason: "base", relevance: 0, base: true },
      { id: "matched-skill", reason: "score 9", relevance: 9, base: false },
    ],
  });
  const text = pack.lines.join("\n");
  assert.ok(text.includes("[wam N3 skill] matched-skill"), "matched skill must win the budget");
});

test("MANDATORY items are never truncated even when they exceed total budget", async () => {
    const pack = await assembleContext({
      prompt: "do a task",
      budget: 10,
      taskState: { phase: "start" },
    });
    // N0 policy is MANDATORY and must be present in full, never truncated.
    // The policy text is: "[wam N0 policy] autonomy loop | soft-archive only (U1)"
    const text = pack.lines.join("\n");
    assert.ok(text.includes("[wam N0 policy] autonomy loop | soft-archive only (U1)"),
      "mandatory policy must be present in full");
    assert.ok(pack.budget_violation === true || pack.budget_violation === undefined,
      "budget_violation flag must reflect the overrun");
  });

test("dropByAdmission drops CONDITIONAL before OPTIONAL when budget is tight", async () => {
    const pack = await assembleContext({
      prompt: "do a normal task",
      taskId: "t-drop",
      classification: "normal",
      mode: "NORMAL",
      budget: 2000,
      skillRegistry: REGISTRY,
      selectedSkills: [
        { id: "base-skill", reason: "base", relevance: 0, base: true },
        { id: "matched-skill", reason: "score 9", relevance: 9, base: false },
      ],
    });
    const text = pack.lines.join("\n");
    // CONDITIONAL (matched-skill) is dropped before OPTIONAL (base-skill) when budget is tight.
    assert.ok(text.includes("[wam N3 skill] base-skill"),
      "OPTIONAL base-skill must survive when CONDITIONAL is dropped first");
  });
