## ADDED Requirements

### Requirement: Claims Classification
The report MUST distinguish mechanism evidence, provider evidence, and task-efficiency evidence, and MUST NOT claim universal token savings.

#### Scenario: Mechanism Evidence
- **WHEN** evidence is derived from deterministic traces
- **THEN** it is reported as mechanism evidence (context rebuild reduction, fast-path behavior, context/input reduction)

#### Scenario: Provider Evidence
- **WHEN** evidence is derived from real-model runs
- **THEN** it is reported as provider evidence (provider-reported token usage, total consumption, repeated-run distributions)

#### Scenario: Task-Efficiency Evidence
- **WHEN** task-efficiency is reported
- **THEN** it requires both token measurements and successful verification

#### Scenario: No Universal Claim
- **WHEN** the report summarizes savings
- **THEN** it does NOT claim universal token savings for WAM

### Requirement: Negative Results
Negative savings MUST remain valid results and MUST preserve their sign.

#### Scenario: Negative Savings Preserved
- **WHEN** WAM consumes more tokens than baseline
- **THEN** the savings value retains its negative sign and is NOT clamped to zero
