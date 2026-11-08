import test from "node:test";
import assert from "node:assert/strict";

import {
  REVIEW_ARTIFACT_LIMITS,
  assertReviewArtifacts,
  detectReviewArtifactFailure,
  normalizeReviewArtifacts,
} from "../../src/agents/review-artifacts.js";
import {
  RoleContractError,
  assertAgentRequest,
} from "../../src/agents/role-contracts.js";

function requestWithInput(input) {
  return {
    taskId: "task-1",
    invocationId: "task-1:REVIEWER:1",
    role: "REVIEWER",
    objective: "review the change",
    acceptanceCriteria: [
      { id: "AC1", description: "Auth is enforced", mandatory: true },
    ],
    input: {
      artifacts: [],
      evidence: [],
      constraints: [],
      priorFindings: [],
      ...input,
    },
    expectedOutput: ["review.verdict"],
  };
}

test("normalizes strings into positional artifact refs", () => {
  const artifacts = normalizeReviewArtifacts(["  first  ", "second"]);

  assert.deepEqual(artifacts, [
    { ref: "artifact-1", content: "first" },
    { ref: "artifact-2", content: "second" },
  ]);
});

test("folds object ref and content fields", () => {
  const artifacts = normalizeReviewArtifacts([
    { path: "src/auth.js", diff: "  +rate limit  " },
    { id: "patch-1", patch: "+middleware" },
  ]);

  assert.deepEqual(artifacts, [
    { ref: "src/auth.js", content: "+rate limit" },
    { ref: "patch-1", content: "+middleware" },
  ]);
});

test("dedupes by ref keeping the first occurrence", () => {
  const artifacts = normalizeReviewArtifacts([
    { ref: "src/auth.js", content: "first" },
    { ref: "src/auth.js", content: "second" },
    { ref: "src/other.js", content: "third" },
  ]);

  assert.deepEqual(artifacts, [
    { ref: "src/auth.js", content: "first" },
    { ref: "src/other.js", content: "third" },
  ]);
});

test("caps the number of entries deterministically", () => {
  const artifacts = normalizeReviewArtifacts(
    ["a", "b", "c", "d"],
    { maxEntries: 2 },
  );

  assert.deepEqual(artifacts, [
    { ref: "artifact-1", content: "a" },
    { ref: "artifact-2", content: "b" },
  ]);
});

test("caps total content characters deterministically", () => {
  const artifacts = normalizeReviewArtifacts(
    ["abcdefgh", "ijkl"],
    { maxContentChars: 5 },
  );

  assert.deepEqual(artifacts, [{ ref: "artifact-1", content: "abcde" }]);
});

test("returns a new array and does not expose the frozen limits for mutation", () => {
  const source = [{ ref: "src/auth.js", content: "diff" }];
  const artifacts = normalizeReviewArtifacts(source);

  assert.notEqual(artifacts, source);
  assert.deepEqual(artifacts, source);
  assert.ok(Object.isFrozen(REVIEW_ARTIFACT_LIMITS));
  assert.equal(REVIEW_ARTIFACT_LIMITS.maxEntries, 8);
  assert.equal(REVIEW_ARTIFACT_LIMITS.maxContentChars, 20000);
});

test("rejects invalid artifact shapes and empty content", () => {
  assert.throws(() => normalizeReviewArtifacts("diff"), RoleContractError);
  assert.throws(() => normalizeReviewArtifacts(["   "]), RoleContractError);
  assert.throws(() => normalizeReviewArtifacts([{}]), RoleContractError);
  assert.throws(
    () => normalizeReviewArtifacts([{ ref: "src/a.js", content: 42 }]),
    RoleContractError,
  );
  assert.throws(
    () => normalizeReviewArtifacts([{ ref: "", content: "diff" }]),
    RoleContractError,
  );
});

test("rejects invalid limits", () => {
  assert.throws(
    () => assertReviewArtifacts([], { maxEntries: 0 }),
    RoleContractError,
  );
  assert.throws(
    () => assertReviewArtifacts([], { maxContentChars: -1 }),
    RoleContractError,
  );
  assert.throws(
    () => assertReviewArtifacts([], { maxEntries: 1.5 }),
    RoleContractError,
  );
});

test("assertReviewArtifacts returns normalized artifacts", () => {
  assert.deepEqual(assertReviewArtifacts([{ path: "src/a.js", diff: "+a" }]), [
    { ref: "src/a.js", content: "+a" },
  ]);
});

test("request validation accepts bounded review artifacts", () => {
  const request = requestWithInput({
    reviewArtifacts: [{ ref: "src/auth.js", content: "diff --git a b" }],
  });

  assert.equal(assertAgentRequest(request), request);
  assert.deepEqual(assertAgentRequest(requestWithInput({})).input, {
    artifacts: [],
    evidence: [],
    constraints: [],
    priorFindings: [],
  });
});

test("request validation rejects malformed or oversized review artifacts", () => {
  assert.throws(
    () => assertAgentRequest(requestWithInput({ reviewArtifacts: "diff" })),
    RoleContractError,
  );
  assert.throws(
    () =>
      assertAgentRequest(
        requestWithInput({ reviewArtifacts: [{ ref: "src/a.js" }] }),
      ),
    RoleContractError,
  );
  assert.throws(
    () =>
      assertAgentRequest(
        requestWithInput({
          reviewArtifacts: Array.from(
            { length: REVIEW_ARTIFACT_LIMITS.maxEntries + 1 },
            (_, index) => ({ ref: `ref-${index}`, content: "diff" }),
          ),
        }),
      ),
    RoleContractError,
  );
  assert.throws(
    () =>
      assertAgentRequest(
        requestWithInput({
          reviewArtifacts: [
            {
              ref: "src/a.js",
              content: "x".repeat(REVIEW_ARTIFACT_LIMITS.maxContentChars + 1),
            },
          ],
        }),
      ),
    RoleContractError,
  );
});

test("detects failing tests in review artifacts", () => {
  assert.equal(detectReviewArtifactFailure([]), null);
  assert.equal(
    detectReviewArtifactFailure([{ ref: "test.log", content: "tests 4 pass 4 fail 0" }]),
    null,
  );
  assert.deepEqual(
    detectReviewArtifactFailure([
      { ref: "test.log", content: "✖ particle\nℹ fail 1" },
    ]),
    { ref: "test.log", content: "✖ particle\nℹ fail 1" },
  );
  assert.equal(
    detectReviewArtifactFailure([
      { ref: "test.log", content: "not ok 1 - particle" },
    ]).ref,
    "test.log",
  );
  assert.equal(
    detectReviewArtifactFailure([
      { ref: "test.log", content: "AssertionError: expected de la Cruz" },
    ]).ref,
    "test.log",
  );
});
