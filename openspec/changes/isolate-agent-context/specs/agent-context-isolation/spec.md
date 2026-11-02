# Agent context isolation

## ADDED Requirements

### Requirement: Explicit candidate sources

WAM MUST select role context only from explicit `artifacts`, `evidence`,
`constraints` and `priorFindings` candidates. The selector MUST NOT accept
coordinator conversation, messages, model output or full task state.

#### Scenario: Coordinator conversation is not a source

- **WHEN** a caller passes a conversation field
- **THEN** it is ignored
- **AND** the returned input contains only the four contract categories

### Requirement: Role-specific context policy

Each role MUST have a deterministic policy for item limits and finding
severities. The Analyst MUST receive no prior findings. The Builder MUST receive
only `HIGH` and `CRITICAL` findings. The Reviewer MUST receive the widest evidence
and finding window.

#### Scenario: Builder filters low-severity findings

- **WHEN** candidates include a `LOW` and a `HIGH` finding
- **THEN** the Builder input contains only the `HIGH` finding

#### Scenario: Analyst starts fresh

- **WHEN** candidates include prior findings for an Analyst invocation
- **THEN** the Analyst input contains no prior findings

### Requirement: Deterministic ranking

Artifacts, evidence and findings MUST be ranked by shared tokens with the
objective, descending, with original order as the tie-break. Constraints MUST
keep declared order. Duplicate refs and duplicate finding ids MUST keep the first
occurrence. The selector MUST NOT use randomness, network calls or embeddings.

#### Scenario: Repeated input

- **WHEN** the same candidates and objective are selected twice
- **THEN** both results are deep-equal

#### Scenario: Duplicate evidence

- **WHEN** the same evidence ref appears twice
- **THEN** it appears once in the input

### Requirement: Bounded context

The selector MUST enforce a per-source item limit and character budget. It MUST
return selected and omitted counts. Overflow MUST omit candidates, never truncate
a ref into an unusable value.

#### Scenario: Character budget exhausted

- **WHEN** candidates exceed the per-source character budget
- **THEN** later candidates are omitted
- **AND** the omitted count is reported

### Requirement: Strict validation

Invalid roles, non-array sources, non-string refs and malformed findings MUST
throw `AgentContextError` containing every detected issue.

#### Scenario: Malformed finding

- **WHEN** a prior finding has an empty description
- **THEN** selection fails with an `AgentContextError`
