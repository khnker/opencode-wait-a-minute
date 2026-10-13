import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashContent, freezeRun, diffAgainstSnapshot } from "./snapshot.mjs";

describe("prompt-eval snapshot", () => {
  it("PQ-003: prompt content change alters the hash", async () => {
    const content1 = "Check if DONE is verified.";
    const content2 = "Check if DONE is verified. [Updated]";
    const h1 = hashContent(content1);
    const h2 = hashContent(content2);
    assert.notStrictEqual(h1, h2, "Hashes should differ for different content");
  });

  it("PQ-004: frozen snapshot ignores later live edits", async () => {
    const suite = { id: "test", version: "1.0" };
    const promptContents = {
      "prompt.1": "Initial content",
    };

    const frozen = freezeRun({ suite, promptContents });
    const frozenHash = frozen.prompts[0].hash;

    // Live prompt changes
    const candidateContents = {
      "prompt.1": "Modified content",
    };

    const diff = diffAgainstSnapshot(frozen, candidateContents);
    assert.ok(diff.changed.includes("prompt.1"), "Snapshot should detect change");
    assert.strictEqual(diff.unchanged.length, 0);
    assert.strictEqual(frozenHash, hashContent("Initial content"), "Snapshot must retain original hash");
  });
});
