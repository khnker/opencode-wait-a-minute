import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const MANIFEST = {
  "agentic-code-foundations": {
    maxSize: 1529,
    level: "R2",
    markers: ["## Code", "Do not build for hypothetical needs.", "## Agent-readable context", "Correctness."],
  },
  "codebase-design": {
    maxSize: 5053,
    level: "R3",
    markers: ["Design **deep modules**", "**Seam**", "**Locality**", "DEEPENING.md", "DESIGN-IT-TWICE.md"],
  },
  "craftsman": {
    maxSize: 5172,
    level: "R2",
    markers: ["Engineering Invariants", "INV-01", "INV-05", "Craftsman Ladder", "RUNG-5", "Output Contract"],
  },
  "design-contract": {
    maxSize: 934,
    level: "R3",
    markers: ["Contract Requirements", ".opencode/contracts/design.json", "States", "Contract Compliant"],
  },
  "design-critique": {
    maxSize: 711,
    level: "R1",
    markers: ["## Criteria", "Hierarchy and action prioritization", "Search and findability"],
  },
  "design-system": {
    maxSize: 409,
    level: "R3",
    markers: ["references/ui-rules.md", "references/tokens.md", "references/image-analysis.md"],
  },
  "diagnosing-bugs": {
    maxSize: 7728,
    level: "R2",
    markers: [
      "Redact every secret first",
      "Phase 1: Build a feedback loop",
      "Red-capable",
      "Do **not** proceed to hypothesise without a loop",
      "Phase 6: Cleanup",
    ],
  },
  "handoff": {
    maxSize: 917,
    level: "R1",
    markers: ["OS temp directory", "verifiable current state", "Redact sensitive information", "suggested skills"],
  },
  "improve-codebase-architecture": {
    maxSize: 5488,
    level: "R2",
    markers: ["deepening opportunities", "deletion test", "architecture-review-", "Top recommendation", "GLOSSARY.md"],
  },
  "linter-negative": {
    maxSize: 3318,
    level: "R2",
    markers: ["Activation Boundary", "Colour Priority", "Hard Rules", "banned-patterns.md"],
  },
  "no-slop-ui": {
    maxSize: 1332,
    level: "R2",
    markers: ["Anti-Slop Core Rules", "No Magic Values", "Contract Fidelity", "State Completeness"],
  },
  "prototype": {
    maxSize: 2802,
    level: "R1",
    markers: ["throwaway code that answers a question", "Skip the polish", "Capture it when done", "PROTOTYPE"],
  },
  "tdd": {
    maxSize: 3188,
    level: "R2",
    markers: ["red → green", "vertical slices", "Anti-patterns", "Tautological", "Horizontal slicing"],
  },
  "visual-review": {
    maxSize: 6935,
    level: "R1",
    markers: ["viewport matrix", "browser tooling was unavailable", "Cliche budget", "Use one leading signature device", "references/review-gates.md"],
  },
  "web-design": {
    maxSize: 1226,
    level: "R2",
    markers: ["When to Activate", "## Routing", "Classify", "references/design-context.md", "references/visual-review.md"],
  },
  "wizard": {
    maxSize: 3315,
    level: "R3",
    markers: ["Scope the procedure", "Map each stage's journey", "Author the wizard", "Verify and hand off", "shellcheck", "STAGES"],
  },
};

function readSkill(name) {
  return readFileSync(join(root, "skills", name, "SKILL.md"), "utf8");
}

describe("reduced skill invariants", () => {
  for (const [name, entry] of Object.entries(MANIFEST)) {
    it(`${name} stays within its reduction budget`, () => {
      const path = join(root, "skills", name, "SKILL.md");
      assert.ok(existsSync(path), `missing skill: ${name}`);
      const body = readSkill(name);
      assert.ok(
        body.length <= entry.maxSize,
        `${name} is ${body.length} chars; budget is ${entry.maxSize} (level ${entry.level})`,
      );
    });

    it(`${name} keeps its required behavior markers`, () => {
      const body = readSkill(name);
      for (const marker of entry.markers) {
        assert.ok(body.includes(marker), `${name} lost marker: ${marker}`);
      }
    });
  }

  it("does not apply the reduction policy to the authoritative skill", () => {
    for (const name of Object.keys(MANIFEST)) {
      assert.notEqual(name, "writing-for-agents");
    }
  });
});
