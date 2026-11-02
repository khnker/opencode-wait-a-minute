# Agent feedback

## ADDED Requirements

### Requirement: Revision feedback

On `REVISION_REQUIRED`, WAM MUST rerun the Builder with the Reviewer findings
as constraints and then rerun the Reviewer. The original review findings MUST
remain available in the returned handoff. The cycle MUST stop when the revision
limit is exhausted.

#### Scenario: Revision accepted

- **WHEN** the Reviewer returns `REVISION_REQUIRED` and a revision cycle remains
- **THEN** the Builder runs again with the review findings as constraints
- **AND** the Reviewer runs again with the Builder's new artifacts and evidence
- **AND** an accepted result returns `COMPLETED`

#### Scenario: Revision exhausted

- **WHEN** the Reviewer returns `REVISION_REQUIRED` and no revision cycle remains
- **THEN** the pipeline stops with `REVISION_REQUIRED`
- **AND** the result is marked `exhausted: true`

### Requirement: Replan feedback

On `REPLAN_REQUIRED`, WAM MUST rerun the Architect with the Reviewer findings,
then the Builder and Reviewer. Decision and open-question constraints from the
replaced design MUST be discarded before the new Architect run.

#### Scenario: Replan accepted

- **WHEN** the Reviewer returns `REPLAN_REQUIRED` and a replan cycle remains
- **THEN** the Architect runs again without superseded decision constraints
- **AND** the Builder receives only the new decisions
- **AND** an accepted result returns `COMPLETED`

#### Scenario: Replan exhausted

- **WHEN** the Reviewer returns `REPLAN_REQUIRED` and no replan cycle remains
- **THEN** the pipeline stops with `REPLAN_REQUIRED`
- **AND** the result is marked `exhausted: true`

### Requirement: Review finding handoff

Review findings MUST become constraint lines containing severity, optional
criterion ID, description, corrective action and evidence. They MUST NOT be
inserted into `priorFindings` because review findings lack the required
`AgentFinding.id`.

#### Scenario: Builder receives a review finding

- **WHEN** the Reviewer returns a finding with a corrective action
- **THEN** the Builder request contains a constraint line with that corrective
  action and evidence

### Requirement: Bounded invocations

Revision and replan limits MUST be non-negative integers. Invocation IDs MUST
increment per role so each retry is auditable. `runAgentOrchestration` MUST keep
zero feedback cycles.

#### Scenario: Retry IDs

- **WHEN** the Builder runs for the second time
- **THEN** its invocation ID ends with `:BUILDER:2`

#### Scenario: Invalid limit

- **WHEN** a negative feedback limit is supplied
- **THEN** orchestration fails with `AgentOrchestrationError`

### Requirement: WAM owns state

Feedback MUST NOT persist or mutate task state, approvals, evidence or
completion. Exhaustion MUST return the last review verdict for WAM to decide the
next step.

#### Scenario: Exhausted revision is not completion

- **WHEN** revision feedback is exhausted
- **THEN** the result status is `REVISION_REQUIRED`
- **AND** it is not reported as task completion
