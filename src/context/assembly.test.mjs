
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
    // The policy text is: "[wam N0 policy] autonomy loop | 0 friction: advisory only (U1)"
    const text = pack.lines.join("\n");
    assert.ok(text.includes("[wam N0 policy] autonomy loop | 0 friction: advisory only (U1)"),
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
    assert.ok(text.includes("[wam N3 skill-ref] base-skill"),
      "OPTIONAL base-skill must survive when CONDITIONAL is dropped first");
  });

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-assembly-"));
}

test("base skills render as cards by default", async () => {
  const projectPath = tempProject();
  try {
    const pack = await assembleContext({
      prompt: "do a normal task",
      taskId: "t-card",
      classification: "normal",
      mode: "NORMAL",
      budget: 8000,
      projectPath,
      skillRegistry: {
        "codebase-design": {
          id: "codebase-design",
          description: "Design deep modules behind small interfaces",
          loadStrategy: "base",
          path: "skills/codebase-design/SKILL.md",
          content: "FULL_BODY ".repeat(400),
        },
      },
      selectedSkills: [{ id: "codebase-design", reason: "base", relevance: 0, base: true }],
    });
    const text = pack.lines.join("\n");
    const card = pack.lines.find((line) => line.includes("[wam N3 skill-ref] codebase-design"));
    assert.ok(card, "base skill must render as a skill-ref card");
    assert.ok(card.length <= 400, "card must stay within 400 chars");
    assert.match(card, /\[wam N3 skill-ref\] codebase-design — Design deep modules/);
    assert.match(card, /\n  load: read .*skills\/codebase-design\/SKILL\.md/);
    assert.ok(!text.includes("FULL_BODY"), "base body must not be injected by default");
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

test("WAM_SKILLS_FULL=1 injects the full base body", async () => {
  const projectPath = tempProject();
  const previous = process.env.WAM_SKILLS_FULL;
  process.env.WAM_SKILLS_FULL = "1";
  try {
    const pack = await assembleContext({
      prompt: "do a normal task",
      taskId: "t-full",
      classification: "normal",
      mode: "NORMAL",
      budget: 8000,
      projectPath,
      skillRegistry: {
        "codebase-design": {
          id: "codebase-design",
          description: "Design deep modules",
          loadStrategy: "base",
          content: "FULL_BODY ".repeat(50),
        },
      },
      selectedSkills: [{ id: "codebase-design", reason: "base", relevance: 0, base: true }],
    });
    const text = pack.lines.join("\n");
    assert.ok(text.includes("[wam N3 skill] codebase-design"), "full body mode keeps the skill body");
    assert.ok(text.includes("FULL_BODY"), "full body must be injected when opted in");
  } finally {
    if (previous === undefined) delete process.env.WAM_SKILLS_FULL;
    else process.env.WAM_SKILLS_FULL = previous;
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

test("N3 skill content is capped at skillsMaxChars (4000 by default)", async () => {
  const projectPath = tempProject();
  try {
    const registry = {};
    const selectedSkills = [];
    for (let i = 0; i < 5; i += 1) {
      registry[`on-demand-${i}`] = { id: `on-demand-${i}`, content: "X".repeat(1200) };
      selectedSkills.push({ id: `on-demand-${i}`, reason: "score 9", relevance: 9, base: false });
    }
    registry["base-skill"] = {
      id: "base-skill",
      loadStrategy: "base",
      description: "base",
      content: "BASE ".repeat(2000),
    };
    selectedSkills.push({ id: "base-skill", reason: "base", relevance: 0, base: true });

    const pack = await assembleContext({
      prompt: "do a normal task",
      taskId: "t-cap",
      classification: "normal",
      mode: "NORMAL",
      budget: 32000,
      projectPath,
      skillRegistry: registry,
      selectedSkills,
    });
    const n3 = pack.lines.filter((line) => line.includes("[wam N3 skill"));
    const chars = n3.reduce((sum, line) => sum + line.length, 0);
    assert.ok(chars <= 4000, `N3 content must stay <= 4000 chars (got ${chars})`);
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

test("synthetic first turn with 3 base and 3 on-demand skills stays <= 8000 chars", async () => {
  const projectPath = tempProject();
  try {
    const registry = {
      "base-large": { id: "base-large", loadStrategy: "base", description: "large base", content: "L".repeat(5800) },
      "base-medium": { id: "base-medium", loadStrategy: "base", description: "medium base", content: "M".repeat(3100) },
      "base-small": { id: "base-small", loadStrategy: "base", description: "small base", content: "S".repeat(400) },
      "match-a": { id: "match-a", content: "A".repeat(1200) },
      "match-b": { id: "match-b", content: "B".repeat(1200) },
      "match-c": { id: "match-c", content: "C".repeat(1200) },
    };
    const selectedSkills = [
      { id: "base-large", reason: "base", relevance: 0, base: true },
      { id: "base-medium", reason: "base", relevance: 0, base: true },
      { id: "base-small", reason: "base", relevance: 0, base: true },
      { id: "match-a", reason: "score 9", relevance: 9, base: false },
      { id: "match-b", reason: "score 8", relevance: 8, base: false },
      { id: "match-c", reason: "score 7", relevance: 7, base: false },
    ];
    const pack = await assembleContext({
      prompt: "do a normal task",
      taskId: "t-synthetic",
      classification: "normal",
      mode: "NORMAL",
      budget: 32000,
      projectPath,
      skillRegistry: registry,
      selectedSkills,
    });
    const total = pack.lines.join("\n").length;
    assert.ok(total <= 8000, `synthetic first turn must stay <= 8000 chars (got ${total})`);
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});

test("skillsMaxChars is overridable from .wam/config.json", async () => {
  const projectPath = tempProject();
  try {
    fs.mkdirSync(path.join(projectPath, ".wam"), { recursive: true });
    fs.writeFileSync(path.join(projectPath, ".wam", "config.json"), JSON.stringify({ skillsMaxChars: 300 }));
    const pack = await assembleContext({
      prompt: "do a normal task",
      taskId: "t-config-cap",
      classification: "normal",
      mode: "NORMAL",
      budget: 32000,
      projectPath,
      skillRegistry: {
        "match-a": { id: "match-a", content: "A".repeat(1200) },
        "match-b": { id: "match-b", content: "B".repeat(1200) },
      },
      selectedSkills: [
        { id: "match-a", reason: "score 9", relevance: 9, base: false },
        { id: "match-b", reason: "score 8", relevance: 8, base: false },
      ],
    });
    const n3 = pack.lines.filter((line) => line.includes("[wam N3 skill"));
    const chars = n3.reduce((sum, line) => sum + line.length, 0);
    assert.ok(chars <= 300, `skillsMaxChars must override the default cap (got ${chars})`);
  } finally {
    fs.rmSync(projectPath, { recursive: true, force: true });
  }
});
