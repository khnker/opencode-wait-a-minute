# Documentation and Comment Quality

## ADDED Requirements

### Requirement: Comment Classification and Cleanup
Production comments MUST be classified C0–C4; stale or misleading (C4) comments MUST be corrected or removed, and redundant (C3) comments removed unless they carry meaningful context.

#### Scenario: No stale comment remains
- **WHEN** the documentation audit completes
- **THEN** no C4 comment remains in production code

#### Scenario: Redundant comments removed
- **WHEN** a C3 comment restates the code
- **THEN** it is removed unless it provides contextual value

### Requirement: High-Risk Invariant Documentation
The system MUST document its high-risk invariants: task lifecycle/state, completion and verification gates, evidence semantics, N0–N3 context levels, continuation fast-path, persistence/recovery, OpenCode integration, token accounting, and benchmark methodology.

#### Scenario: Invariants are documented
- **WHEN** a maintainer inspects a high-risk area
- **THEN** its invariants are documented without reverse-engineering the implementation

#### Scenario: Documentation does not change behavior
- **WHEN** documentation work is performed
- **THEN** runtime behavior is unchanged and the test suite still passes
