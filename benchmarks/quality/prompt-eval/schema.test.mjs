import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PromptEvalSchemaError, validateSuite, validateDataset } from "./schema.mjs";

describe("prompt-eval schema", () => {
  it("PQ-001: duplicate scenario id rejected with explicit error", async () => {
    const suite = {
      id: "test-suite",
      version: "1.0.0",
      scenarios: [
        {
          id: "dup",
          suite: "test-suite",
          severity: "low",
          context: "x",
          promptRef: "policy.verify.rules",
          criteria: [{ id: "c1", kind: "must", required: true, check: "x" }],
          expectation: "x",
        },
        {
          id: "dup",
          suite: "test-suite",
          severity: "low",
          context: "y",
          promptRef: "policy.verify.rules",
          criteria: [{ id: "c2", kind: "must", required: true, check: "y" }],
          expectation: "y",
        },
      ],
    };
    assert.throws(() => validateSuite(suite), PromptEvalSchemaError);
  });

  it("PQ-002: missing mandatory criterion rejected, not silently skipped", async () => {
    const suite = {
      id: "test-suite",
      version: "1.0.0",
      scenarios: [
        {
          id: "s1",
          suite: "test-suite",
          severity: "low",
          context: "x",
          promptRef: "policy.verify.rules",
          criteria: [{ kind: "must", required: true, check: "x" }], // missing id
          expectation: "x",
        },
      ],
    };
    assert.throws(() => validateSuite(suite), PromptEvalSchemaError);
  });
});
