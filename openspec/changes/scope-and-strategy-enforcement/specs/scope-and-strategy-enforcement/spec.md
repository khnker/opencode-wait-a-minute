# Proposal: scope-and-strategy-enforcement

## ADDED Requirements
### Requirement: Scope Object Tracking
Each task MUST carry a `scope` object that tracks the relationship between STRATEGY (objective, scope, allowed/prohibited actions) and CURRENT EXECUTION (hypothesis, experiment, files touched, actions performed, evidence).
#### Scenario: Scope captures strategy vs execution
- **WHEN** a task executes an action
- **THEN** the scope object records the relationship between the approved strategy and the current execution
### Requirement: Scope Drift Detection
A `detectScopeDrift(strategy, execution)` function MUST classify drift as one of `none`, `small_safe`, `material`, or `prohibited`.
#### Scenario: Drift classified
- **WHEN** the current execution diverges from the approved strategy
- **THEN** detectScopeDrift returns the appropriate classification (none, small_safe, material, or prohibited)
### Requirement: Scope Drift Policy
`small_safe` drift MUST be allowed and recorded; `material` drift MUST require authorization; `prohibited` drift MUST block execution.
#### Scenario: Material drift requires authorization
- **WHEN** drift is classified as material
- **THEN** execution requires authorization before proceeding
### Requirement: Drift Recording
A `recordDrift()` function MUST append drift events to the execution log.
#### Scenario: Drift appended to execution log
- **WHEN** drift is detected
- **THEN** recordDrift appends the event to the execution log