# Design: review-artifacts-visible

## Research

- Agent-as-a-Judge (Zhuge et al., 2024) evaluates agents with execution
  artifacts and traces, not only final answers: https://arxiv.org/abs/2410.10934
- Reflexion (Shinn et al., 2023) shows feedback loops need the failure signal in
  the next attempt: https://arxiv.org/abs/2303.11366
- OpenCode session model: reviewer is a read-only child session; it cannot run
  tests itself (`src/agents/role-contracts.js`), so independent test output must
  arrive as prompt input.

## Problem

`normalizeReviewArtifacts` validates review artifacts and
`runAgentOrchestration` passes them only to the REVIEWER request
(`src/agents/orchestrator.js:274-277`). `buildAgentUserPrompt` renders
`input.artifacts`, `input.evidence`, `input.constraints` and
`input.priorFindings`, but not `input.reviewArtifacts`
(`src/agents/invocation-adapter.js:175-196`). The reviewer never sees the
independent test log, so a failing hidden test cannot drive
`REVISION_REQUIRED`.

## Alternatives

1. **Render `reviewArtifacts` as a dedicated reviewer section (chosen).**
   Smallest change, keeps the semantic separation between implementation
   artifacts and independent review evidence, and makes the failure signal
   explicit.
2. Merge `reviewArtifacts` into `input.artifacts`. Rejected: conflates builder
   output with independent evidence and would also show them to non-reviewer
   roles if the merge happens upstream.
3. Deterministic post-processing of the verdict from artifact text. Rejected:
   artifacts are free-form; string matching for "fail" is brittle and would
   override the reviewer without a real evaluation.

## Decisions

### D1. Dedicated prompt section

Add `renderReviewArtifacts` and a "Review artifacts:" section to
`buildAgentUserPrompt`; render each `{ ref, content }` pair. The section is
present for every role but empty (`- (none)`) when the request has no review
artifacts, matching the existing render style.

### D2. Reviewer rule

Extend the reviewer system rule: a review artifact that shows a failing test, a
contradiction, or a missing required file must produce `REVISION_REQUIRED` with
a finding citing the artifact. An artifact may be treated as stale only when
newer evidence in the prompt contradicts it.

### D3. Deterministic first-review gate

A fresh web run showed that making the artifact visible and stating the rule is
not sufficient: the reviewer returned `ACCEPTED` while the injected artifact
contained `✖ suffix` and `fail 1`. Prompt-only enforcement was rejected because
it depends on model compliance.

Chosen: on the **first** review (`cycles.revisions === 0`), if the verdict is
`ACCEPTED` and `detectReviewArtifactFailure` finds a failing artifact, override
the verdict to `REVISION_REQUIRED` and append a `CRITICAL` finding citing the
artifact ref. Later reviews are not overridden, so a revision can legitimately
accept an artifact that newer evidence has made stale.

Detection uses a narrow marker set (`✖`, `not ok`, `FAIL`/`FAILED`,
`AssertionError`, `fail: N`, `N failed/failing/failures`) instead of a bare
`fail` substring; the unit suite covers the `pass 4 fail 0` false-positive case.
The reviewer verdict remains authoritative after the first revision cycle.
