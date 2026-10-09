
import test from "node:test";
import assert from "node:assert/strict";
import { assembleContext } from "./assembly.js";

const REGISTRY = {
  "matched-skill": { id: "matched-skill", content: "MATCHED_BODY ".repeat(30) },
  "base-skill": { id: "base-skill", content: "BASE_BODY ".repeat(400) },
};

test("regression: injects skill bodies without ReferenceError (skill.base before loop)", () => {
  const pack = assembleContext({
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

test("task-matched skills are prioritized over base skills under tight budget", () => {
  const pack = assembleContext({
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
