# Design: Provide independent review artifacts

## Problem

`runAgentOrchestration` builds each role request from `selectRoleContext`, which returns
only references (`artifacts`, `evidence`, `constraints`, `priorFindings`). The REVIEWER
can therefore accept a change without seeing the patch. The contract already separates
roles and validates requests; it lacks a reviewer-only channel for the changed content.

## Research

- Google Engineering Practices, "What to look for in a code review":
  https://google.github.io/eng-practices/review/reviewer/looking-for.html
  Reviewers must examine the change (design, functionality, complexity, tests, security),
  not just the list of touched files.
- NIST SP 800-218, Secure Software Development Framework (SSDF):
  https://csrc.nist.gov/pubs/sp/800/218/final
  Verification should be performed against the produced artifact and recorded as evidence.
- OWASP Top 10 for LLM Applications 2025, LLM06 Excessive Agency:
  https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
  Independent oversight must be able to inspect actions rather than trust an agent's
  self-report.

## Alternatives Considered

1. **Reviewer reads files through a tool at review time (rejected).** It adds a runtime
   dependency on filesystem access, introduces nondeterminism (the tree may change between
   build and review), and does not work for remote adapters. Passing a bounded snapshot is
   deterministic and transport-agnostic.
2. **Append the diff to the existing `artifacts` string list (rejected).** `artifacts` is a
   reference channel consumed by every role and trimmed by the context selector. Mixing
   content into it would leak the diff to ANALYST/ARCHITECT/BUILDER, break role isolation,
   and silently lose content to the artifact character budget.
3. **Unbounded reviewer payload (rejected).** It risks prompt-size blowups and memory
   growth. The chosen design caps entries and total characters deterministically.
4. **Chosen: a dedicated, bounded `reviewArtifacts` channel.** It is explicit, only attached
   to REVIEWER requests, validated at the trust boundary, and reuses the existing request
   contract.

## Design

### Normalization

`normalizeReviewArtifacts` accepts strings or objects:

- A string becomes `{ ref: "artifact-<n>", content: value }`, where `<n>` is the 1-based
  input position.
- An object requires a non-empty `ref`, `path`, or `id` and a string
  `content`, `diff`, or `patch`.
- Values are trimmed, empty content is rejected, refs are deduped (first wins), entries are
  capped at `maxEntries`, and total content is capped at `maxContentChars`. When the last
  entry exceeds the remaining budget it is truncated to that budget; iteration then stops.
- The function always returns a new array of `{ ref, content }` objects.

`assertReviewArtifacts` validates limits and shape, throws `RoleContractError` on
violations, and otherwise returns the normalized array. `REVIEW_ARTIFACT_LIMITS` is frozen
and re-exported from `review-artifacts.js` so callers share one source of truth.

### Request contract

`REQUEST_INPUT_KEYS` gains `reviewArtifacts`. `assertAgentRequest` accepts an optional
array of `{ ref, content }` objects and enforces the same count and character bounds.
Requests without the key remain valid, so existing adapters and fixtures are unaffected.

### Orchestration

`runAgentOrchestration` / `runAgentFeedbackOrchestration` accept optional `reviewArtifacts`.
They normalize once, then attach the array to `request.input` only when the role is
REVIEWER and the array is non-empty. Other roles cannot receive the field; the shared
request validator rejects it if someone tries.

### Task integration

`buildTaskAgentInput` collects `task.reviewArtifacts` (array entries), plus top-level
`task.diff` and `task.patch` (string or `{ ref|path|id, content|diff|patch }`), normalizes
them, and includes `reviewArtifacts` in the orchestration options. `runTaskAgentStep`
already spreads the built input into `runAgentFeedbackOrchestration`, so the reviewer
receives the diff without extra glue.

## Risks

- Truncation can hide the tail of a very large diff. The cap is explicit and recorded in
  `REVIEW_ARTIFACT_LIMITS`; callers should pass the slice they want reviewed.
- The reviewer still depends on callers supplying the diff. A task without `reviewArtifacts`,
  `diff`, or `patch` keeps the previous reference-only behavior; this change does not invent
  content.
