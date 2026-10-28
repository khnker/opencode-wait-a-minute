import test from "node:test";
import assert from "node:assert/strict";

import { buildContextBrief } from "../../src/context/context-brief.js";

test("brief includes contract, requirements, decisions and entities", () => {
  const brief = buildContextBrief({
    taskId: "task-1",
    taskState: {
      phase: "IMPLEMENTING",
      contract: {
        status: "APPROVED",
        objective: "Implement OAuth2 endpoint",
        constraints: ["do not touch production"],
        nonGoals: ["UI work"],
        unknowns: [{ id: "U1", status: "blocking", question: "Scope?" }],
      },
      requirements: [
        { id: "r1", title: "endpoint", status: "pending" },
        { id: "r2", title: "tests", status: "verified" },
      ],
    },
    decisions: [{ decision: "use soft delete" }],
    entities: [{ kind: "file", value: "src/auth.js" }],
    maxChars: 2000,
  });

  assert.ok(brief.text.includes("Implement OAuth2 endpoint"));
  assert.ok(brief.text.includes("r1"));
  assert.ok(brief.text.includes("use soft delete"));
  assert.ok(brief.text.includes("src/auth.js"));
  assert.ok(brief.text.length <= 2000);
});
