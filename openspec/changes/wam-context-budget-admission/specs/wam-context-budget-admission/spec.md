# Design: wam-context-budget-admission

## ADDED Requirements
### Requirement: Admission Classification
Each context item MUST carry an `admission` field of `MANDATORY`, `CONDITIONAL`, or `OPTIONAL`, together with a `reason` and a `tokenCost`.
#### Scenario: Item carries admission metadata
- **WHEN** a context item is admitted
- **THEN** it carries admission, reason, and tokenCost fields
### Requirement: Admission Ordering
Admission ordering MUST be MANDATORY first, then CONDITIONAL, then OPTIONAL.
#### Scenario: MANDATORY admitted before OPTIONAL
- **WHEN** context is assembled
- **THEN** MANDATORY items are admitted before CONDITIONAL and OPTIONAL items
### Requirement: Budget Overflow Handling
When MANDATORY items exceed the budget, the system MUST first drop OPTIONAL items, then reduce CONDITIONAL items, then compact if a safe representation exists, and if it still does not fit MUST set `sufficiency = insufficient`.
#### Scenario: Insufficient when mandatory cannot fit
- **WHEN** MANDATORY items still exceed budget after dropping OPTIONAL and reducing CONDITIONAL
- **THEN** sufficiency is set to insufficient
### Requirement: No Silent MANDATORY Omission
A MANDATORY item MUST never be omitted silently and then processing continue as if nothing happened.
#### Scenario: MANDATORY omission is explicit
- **WHEN** a MANDATORY item cannot be included
- **THEN** the omission is explicit and sufficiency reflects it rather than continuing silently
### Requirement: Rationale Recording
The system MUST record rationale for budget-exceeded, mandatory-preserved, optional-dropped, dependency-preserved, and sufficiency-failed events.
#### Scenario: Rationale recorded
- **WHEN** budget handling decisions occur
- **THEN** budget-exceeded, mandatory-preserved, optional-dropped, dependency-preserved, and sufficiency-failed rationales are recorded