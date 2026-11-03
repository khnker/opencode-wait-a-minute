# agent-review-artifacts Specification

## ADDED Requirements

### Requirement: Review artifacts are normalized and bounded

The system MUST normalize reviewer artifacts into a new array of `{ ref, content }`
objects. It MUST accept strings and objects, derive a deterministic ref for strings,
reject empty content, dedupe by ref, and enforce `maxEntries` and `maxContentChars`
deterministically.

#### Scenario: Strings become refs

- **WHEN** a caller supplies `["diff --git a/x b/x"]`
- **THEN** normalization returns `[{ ref: "artifact-1", content: "diff --git a/x b/x" }]`

#### Scenario: Object fields are folded

- **WHEN** a caller supplies `{ path: "src/x.js", diff: "  +line  " }`
- **THEN** normalization returns `[{ ref: "src/x.js", content: "+line" }]`

#### Scenario: Duplicate refs are deduped

- **WHEN** two artifacts share the same ref
- **THEN** only the first occurrence is returned

#### Scenario: Bounds are enforced

- **WHEN** more entries or content than the limits allow are supplied
- **THEN** the result contains at most `maxEntries` entries and at most
  `maxContentChars` content characters

### Requirement: Invalid review artifacts fail loud

`assertReviewArtifacts` MUST throw `RoleContractError` for a non-array input, a missing or
empty ref, non-string or empty content, or invalid limits. It MUST return the normalized
array when the input is valid.

#### Scenario: Empty content is rejected

- **WHEN** an artifact has `content: "   "`
- **THEN** validation throws `RoleContractError`

#### Scenario: Invalid limits are rejected

- **WHEN** `maxEntries` or `maxContentChars` is not a positive integer
- **THEN** validation throws `RoleContractError`

### Requirement: Only the reviewer receives review artifacts

Orchestration MUST accept optional `reviewArtifacts`, normalize them once, and attach
`input.reviewArtifacts` only to REVIEWER requests when the normalized array is non-empty.
Requests for ANALYST, ARCHITECT, and BUILDER MUST NOT contain the field. Omitting review
artifacts MUST preserve existing behavior.

#### Scenario: Reviewer sees the diff

- **WHEN** orchestration is called with a supplied diff
- **THEN** the REVIEWER request input contains that diff under `reviewArtifacts`

#### Scenario: Non-reviewers do not see the diff

- **WHEN** orchestration is called with a supplied diff
- **THEN** ANALYST, ARCHITECT, and BUILDER requests do not contain `reviewArtifacts`

#### Scenario: No artifacts supplied

- **WHEN** orchestration is called without review artifacts
- **THEN** no request gains a `reviewArtifacts` field and the existing pipeline is unchanged

### Requirement: Task diffs flow into review

`buildTaskAgentInput` MUST collect `task.reviewArtifacts`, string or object `task.diff`, and
string or object `task.patch`, normalize them, and include `reviewArtifacts` in its result.
`runTaskAgentStep` MUST pass that result to the feedback orchestration.

#### Scenario: task.diff reaches the reviewer

- **WHEN** a task carries `diff: "..."` and the step runs
- **THEN** the REVIEWER request input includes that diff under `reviewArtifacts`

#### Scenario: Task without a diff is unchanged

- **WHEN** a task has no review artifacts, diff, or patch
- **THEN** `buildTaskAgentInput` returns an empty `reviewArtifacts` array and no request
  gains the field
