# wam-context-admission-enforcement — Design

## ADDED Requirements
### Requirement: Router Authority Over Sufficiency
When a Router result is available (`source === "router"`), the Router's sufficiency MUST control the Assembly's reported sufficiency. Router `omitted` MANDATORY nodes MUST produce explicit `admission: MANDATORY omitted by router` rationale entries and MUST never be silent drops.
#### Scenario: Omitted MANDATORY node is explicit
- **WHEN** the Router omits a MANDATORY node
- **THEN** an explicit rationale entry `admission: MANDATORY omitted by router` is produced rather than a silent drop
### Requirement: N0/N2 Canonical Reservation
N0 (global policy) and N2 (live task state) MUST be MANDATORY. N2 task state reservation (`n2TaskSpent`) MUST be tracked in `reserved`, and N0 MUST be reserved exactly once.
#### Scenario: N0 reserved once
- **WHEN** assembly reserves the N0 budget
- **THEN** N0 is reserved exactly once and the duplicate `n0Spent` declaration does not exist
### Requirement: Explicit Fallback Source
When the Router is unavailable (`source === "fallback"` or null graph), Assembly MUST use the legacy selector and report `source: "legacy"` in its result. Router sufficient MUST imply Assembly sufficient; Router insufficient MUST imply Assembly insufficient.
#### Scenario: Fallback reported as legacy
- **WHEN** the Router is unavailable
- **THEN** Assembly uses the legacy selector and reports source: "legacy"
### Requirement: Assembly Does Not Redeclare Admission
Assembly MUST consume the Router's admission decisions and MUST import `ADMISSION` from `context-router.js` as the single source of truth.
#### Scenario: Single admission source
- **WHEN** Assembly needs admission classes
- **THEN** it uses `ADMISSION` imported from `context-router.js` rather than redeclaring them