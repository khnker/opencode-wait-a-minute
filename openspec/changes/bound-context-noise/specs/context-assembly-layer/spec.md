# context-assembly-layer — delta

## ADDED Requirements
### Requirement: N2 next action is derived, not trusted
The N2 line SHALL recompute the next action from requirement statuses.
#### Scenario: All requirements verified
- **WHEN** every requirement is `verified` with evidence
- **THEN** N2 reports `Tarea completa — contrato verificado`
- **AND** a stale `taskState.nextAction` is ignored

### Requirement: N1 history is bounded
Decision and recent-change sections SHALL be capped to 2 sections, 240 chars
each (decisions: 500 chars total).
#### Scenario: Stale decisions
- **WHEN** the decisions document has many relevant sections
- **THEN** at most 2 are injected and the line is <= 500 chars

### Requirement: Calibratable estimator
WAM's internal token estimate SHALL use `WAM_CHARS_PER_TOKEN` when set.
#### Scenario: Spanish calibration
- **WHEN** `WAM_CHARS_PER_TOKEN=3.2`
- **THEN** `estTokens` divides by 3.2 instead of 4
