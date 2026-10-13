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
          criteria: [{ id: "c1", required: true, description: "x", oracle: { kind: "includes-all", values: ["x"], flags: "i" } }],
          expectation: "x",
        },
        {
          id: "dup",
          suite: "test-suite",
          severity: "low",
          context: "y",
          promptRef: "policy.verify.rules",
          criteria: [{ id: "c2", required: true, description: "y", oracle: { kind: "includes-all", values: ["y"], flags: "i" } }],
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
          criteria: [{ required: true, description: "x", oracle: { kind: "includes-all", values: ["x"], flags: "i" } }], // missing id
          expectation: "x",
        },
      ],
    };
    assert.throws(() => validateSuite(suite), PromptEvalSchemaError);
  });

  it("PQ-ORACLE-01: oracle kind is required", async () => {
    const suite = {
      id: "test-suite",
      version: "1.0.0",
      scenarios: [
        {
          id: "s1",
          suite: "test-suite",
          severity: "low",
          context: "x",
          promptRef: "p1",
          criteria: [{ id: "c1", required: true, description: "x", oracle: { values: ["y"] } }],
          expectation: "x",
        },
      ],
    };
    assert.throws(() => validateSuite(suite), PromptEvalSchemaError);
  });

  it("PQ-ORACLE-02: oracle values array must be non-empty strings", async () => {
    const suite = {
      id: "test-suite",
      version: "1.0.0",
      scenarios: [
        {
          id: "s1",
          suite: "test-suite",
          severity: "low",
          context: "x",
          promptRef: "p1",
          criteria: [{ id: "c1", required: true, description: "x", oracle: { kind: "includes-all", values: [] } }],
          expectation: "x",
        },
      ],
    };
    assert.throws(() => validateSuite(suite), PromptEvalSchemaError);
  });

  it("PQ-ORACLE-03: oracle values must be non-empty strings", async () => {
    const suite = {
      id: "test-suite",
      version: "1.0.0",
      scenarios: [
        {
          id: "s1",
          suite: "test-suite",
          severity: "low",
          context: "x",
          promptRef: "p1",
          criteria: [{ id: "c1", required: true, description: "x", oracle: { kind: "includes-all", values: ["valid", "", "also valid"] } }],
          expectation: "x",
        },
      ],
    };
    assert.throws(() => validateSuite(suite), PromptEvalSchemaError);
  });
});
