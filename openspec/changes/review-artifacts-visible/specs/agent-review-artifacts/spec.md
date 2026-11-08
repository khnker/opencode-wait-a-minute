# Agent review artifacts

## ADDED Requirements

### Requirement: Reviewer prompt includes review artifacts

WAM MUST render every normalized review artifact in the reviewer prompt,
including its `ref` and `content`, so the reviewer can evaluate independent
test output and evidence.

#### Scenario: Failing hidden test is visible

- **WHEN** the reviewer request contains a review artifact
  `{ ref: "review/hidden.log", content: "fail 1" }`
- **THEN** the reviewer prompt contains `review/hidden.log` and `fail 1`
- **AND** the reviewer can cite that artifact in a finding

#### Scenario: No review artifacts

- **WHEN** the reviewer request contains no review artifacts
- **THEN** the prompt renders the section as `- (none)`
- **AND** the reviewer still receives the rest of the evidence

### Requirement: Failing review artifact requires revision

The reviewer MUST return `REVISION_REQUIRED` with at least one finding when a
review artifact shows a failing test, a contradiction with the implementation,
or a missing required file, unless newer evidence in the prompt contradicts the
artifact.

#### Scenario: Failing artifact is not ignored

- **WHEN** a review artifact reports a failing test and no newer evidence
  contradicts it
- **THEN** the reviewer verdict is `REVISION_REQUIRED`
- **AND** the finding cites the artifact ref

### Requirement: First review cannot accept a failing artifact

On the first review cycle, WAM MUST NOT accept a change when a review artifact
contains a failing-test marker, even if the reviewer returned `ACCEPTED`.

#### Scenario: Reviewer accepts despite a failing artifact

- **WHEN** the first reviewer returns `ACCEPTED`
- **AND** a review artifact contains a failing-test marker
- **THEN** WAM overrides the verdict to `REVISION_REQUIRED`
- **AND** appends a `CRITICAL` finding that cites the artifact ref
- **AND** the loop proceeds to a revision builder
