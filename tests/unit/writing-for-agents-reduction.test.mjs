import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const skillPath = join(root, "skills", "writing-for-agents", "SKILL.md");
const referencePath = join(
  root,
  "skills",
  "writing-for-agents",
  "references",
  "skill-reduction.md",
);

function read(path) {
  return readFileSync(path, "utf8");
}

describe("writing-for-agents reduction policy", () => {
  it("activates for pruning and restructuring and points to the reference", () => {
    const body = read(skillPath);
    assert.match(body, /pruning|reducing/);
    assert.match(body, /restructuring/);
    assert.match(body, /## Skill reduction/);
    assert.match(body, /references\/skill-reduction\.md/);
  });

  it("keeps the contract in the main body", () => {
    const body = read(skillPath);
    assert.match(body, /unique responsibility/);
    assert.match(body, /changes agent behaviour|changes agent behavior/);
    assert.match(body, /no-ops, duplication, and stale content/);
    assert.match(body, /Preserve decision rules, constraints, and failure handling/);
    assert.match(body, /Move conditional knowledge behind an on-demand pointer/);
    assert.match(body, /Consolidate overlapping responsibilities/);
    assert.match(body, /activation and exclusion boundaries/);
    assert.match(body, /target tokenizer/);
    assert.match(body, /representative tasks/);
  });

  it("keeps the full rule set, type rules, severity, and validation in the reference", () => {
    const reference = read(referencePath);
    for (let i = 1; i <= 10; i += 1) {
      assert.match(reference, new RegExp(`RED-${String(i).padStart(2, "0")}`));
    }
    const typeHeadings = [
      "Router / Orchestration",
      "Engineering / Implementation",
      "Diagnostic / Troubleshooting",
      "Verification / Testing",
      "Architecture / Design Reference",
      "UI / Visual Design",
      "Prototype / Exploration",
      "Handoff / Communication",
      "Meta-skill / Skill Authoring",
    ];
    for (const [index, heading] of typeHeadings.entries()) {
      const prefix = String.fromCharCode(65 + index);
      assert.ok(
        reference.includes(`### ${prefix}. ${heading}`),
        `missing type: ${heading}`,
      );
    }
    for (let i = 0; i <= 5; i += 1) {
      assert.match(reference, new RegExp(`\\| R${i} \\|`));
    }
    assert.match(reference, /R1 → R2 → R3 → R4 → R5/);
    for (const dimension of [
      "Activation",
      "Precision",
      "Constraints",
      "Coverage",
      "Independence",
      "Regression",
      "Token cost",
    ]) {
      assert.ok(reference.includes(`| ${dimension} |`), `missing dimension: ${dimension}`);
    }
  });

  it("does not duplicate the policy in other skills", () => {
    const skillsDir = join(root, "skills");
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "writing-for-agents") continue;
      const path = join(skillsDir, entry.name, "SKILL.md");
      let body;
      try {
        body = read(path);
      } catch {
        continue;
      }
      assert.doesNotMatch(body, /SKILL REDUCTION CONTRACT/, `${entry.name} duplicates the contract`);
      assert.doesNotMatch(body, /RED-01/, `${entry.name} duplicates reduction rule IDs`);
    }
  });
});
