# Design: Action Risk Envelope

## ADDED Requirements
### Requirement: Action Risk Classification
Every tool action MUST resolve to exactly one of SAFE, GUARDED, or BLOCKED. SAFE covers read-only or negligible/reversible effects and MAY execute autonomously; GUARDED covers mutating, bounded, reversible effects and MAY execute autonomously within scope if no protected resources are affected; BLOCKED covers destructive, irreversible, or sensitive effects and MUST require authorization.
#### Scenario: Destructive action requires authorization
- **WHEN** an action is classified as BLOCKED (e.g. delete data, drop DB, production deploy)
- **THEN** the action is rejected unless explicit authorization is present
### Requirement: Risk Evaluation Logic
An `evaluateAction(action)` function MUST determine the classification based on tool type, action arguments, task scope, and blast radius (scope, reversibility, persistence, data impact).
#### Scenario: Out-of-scope mutation classified as BLOCKED or GUARDED
- **WHEN** an action mutates state outside the declared task scope
- **THEN** evaluateAction returns BLOCKED or GUARDED rather than SAFE
### Requirement: Risk Enforcement
The plugin MUST intercept tool calls: a BLOCKED result is rejected with an explanation, and a GUARDED result triggers additional checks such as scope validation.
#### Scenario: GUARDED action triggers scope validation
- **WHEN** evaluateAction returns GUARDED
- **THEN** additional checks (scope validation) run before the action is allowed