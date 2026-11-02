# Agent orchestration benchmark

## ADDED Requirements

### Requirement: Deterministic scenarios

The benchmark MUST run fixed scenarios with fake adapters and MUST NOT make
model calls or assert wall-clock time.

#### Scenario: Accepted first pass

- **WHEN** every role completes and the Reviewer accepts
- **THEN** the outcome is accepted with zero feedback cycles

#### Scenario: Revision accepted

- **WHEN** the Reviewer requests a revision and the next Builder result fixes it
- **THEN** the outcome is accepted with one revision cycle
- **AND** the review finding is recorded

#### Scenario: Replan accepted

- **WHEN** the Reviewer requests a replan and the next Architect result is
  implementable
- **THEN** the outcome is accepted with one replan cycle

#### Scenario: Exhausted feedback

- **WHEN** the Reviewer keeps requesting revision beyond the configured bound
- **THEN** the outcome is marked exhausted
- **AND** no further Builder invocation occurs

### Requirement: Comparative metrics

The benchmark MUST compare a single-agent baseline with the bounded feedback
pipeline and MUST report invocation counts, feedback cycles, caught findings,
estimated tokens and defect resolution.

#### Scenario: Baseline records a false accept

- **WHEN** the baseline implementation misses the injected defect and no review
  runs
- **THEN** the baseline record reports the defect as unresolved

#### Scenario: Feedback catches the defect

- **WHEN** the Reviewer requests a revision for the injected defect
- **THEN** the feedback record reports the finding as caught
- **AND** reports the additional invocations and cycles

#### Scenario: Reproducible output

- **WHEN** the benchmark runs twice with the same scenario
- **THEN** both runs produce identical metrics

### Requirement: Evidence notes

The benchmark MUST document its method, metric definitions and limitations,
including that token counts are estimates.

#### Scenario: Token limitations

- **WHEN** a reader inspects the benchmark methodology
- **THEN** the document states that token counts are character-based estimates
- **AND** that the benchmark measures coverage and boundedness, not model quality
