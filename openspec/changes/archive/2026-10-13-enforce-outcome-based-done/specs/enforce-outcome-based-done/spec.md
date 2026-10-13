# Specification: Enforce Outcome-Based Done

## ADDED Requirements

### Requirement: Strict Outcome Contract Validation
- Outcome contracts MUST validate: `taskId`, `objective`, and `acceptanceCriteria` with stable `id` fields
- Each criterion MUST have a boolean `mandatory` field (default true)
- Evidence association MUST use stable IDs, not substring matching

#### Scenario: Valid contract
- **WHEN** an outcome contract includes non-empty `taskId`, `objective`, and `acceptanceCriteria` with stable `id` fields
- **AND** each criterion has `mandatory` boolean (default true)
- **THEN** the contract is considered valid
- **AND** the evaluator proceeds to evidence assessment

#### Scenario: Invalid contract
- **WHEN** an outcome contract is missing `taskId`, `objective`, or `acceptanceCriteria`
- **AND** completion is attempted
- **THEN** completion MUST be rejected
- **AND** `canComplete` returns `allowed: false` with reason "invalid contract"

### Requirement: Mandatory vs Optional Criteria Evaluation
- Final outcome status MUST be derived from mandatory criteria only
- Optional criteria MUST NOT block `ACHIEVED` if mandatory criteria are satisfied
- Optional criteria status MUST be tracked and reported separately

#### Scenario: Mandatory satisfied, optional pending
- **WHEN** all mandatory criteria are satisfied and at least one optional criterion is unverified
- **AND** completion is attempted
- **THEN** outcome status can be `ACHIEVED`
- **AND** optional criteria report their separate status

#### Scenario: Mandatory unmet blocks ACHIEVED
- **WHEN** at least one mandatory criterion is not satisfied
- **AND** completion is attempted
- **THEN** outcome status MUST NOT be `ACHIEVED`
- **AND** `canComplete` returns `allowed: false`

### Requirement: Verified Observations Only
- Observations MUST carry a `status` field (`VERIFIED`, `UNVERIFIED`, `FAILED`)
- Only `VERIFIED` observations can satisfy a criterion
- Unverified observations MUST result in `UNVERIFIED` criterion status

#### Scenario: Verified observation satisfies criterion
- **WHEN** a criterion has a `VERIFIED` observation with sufficient provenance
- **AND** the observation is relevant to the criterion
- **THEN** the criterion status is `SATISFIED`

#### Scenario: Unverified observation does not satisfy
- **WHEN** a criterion has only an `UNVERIFIED` observation
- **AND** completion is attempted
- **THEN** the criterion status is `UNVERIFIED`
- **AND** outcome `ACHIEVED` is not authorized

### Requirement: Temporal Evidence Resolution
- Evidence items MUST have a `timestamp` field
- When evaluating a criterion, newer evidence (`timestamp` comparison) MUST supersede older evidence for the same criterion
- Explicit invalidation markers MUST be respected

#### Scenario: Newer evidence supersedes older
- **WHEN** a criterion has older evidence marked `FAILED` and newer evidence marked `VERIFIED`
- **AND** the newer evidence has a later `timestamp`
- **THEN** the criterion is evaluated based on the newer `VERIFIED` evidence
- **AND** the older `FAILED` evidence is superseded

### Requirement: Completion Gate Integration
- `canComplete(taskRoot, taskId)` MUST evaluate outcome before allowing completion
- If outcome status is not `ACHIEVED`, or mandatory criteria are unmet/unverified, `canComplete` MUST return `allowed: false`
- Blockers MUST include outcome-specific reasons

#### Scenario: Outcome evaluation blocks completion
- **WHEN** `canComplete` is called for a task with unsatisfied mandatory criteria
- **AND** the outcome evaluator returns a non-`ACHIEVED` status
- **THEN** `canComplete` returns `allowed: false`
- **AND** blockers include an outcome-specific reason

#### Scenario: Valid outcome allows completion
- **WHEN** `canComplete` is called for a task with all mandatory criteria satisfied and `ACHIEVED` outcome
- **AND** all other existing checks pass
- **THEN** `canComplete` returns `allowed: true`
- **AND** no outcome-related blockers are added

### Requirement: Fail-Closed on Evaluator Errors
- Evaluator errors, malformed contracts, or missing evidence MUST result in `canComplete: false`

#### Scenario: Evaluator error blocks completion
- **WHEN** the outcome evaluator throws or returns an error
- **AND** `canComplete` is called
- **THEN** `canComplete` returns `allowed: false`
- **AND** blockers include "outcome evaluator error (fail-closed)"