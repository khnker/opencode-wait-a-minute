# Duplication Audit

## ADDED Requirements

### Requirement: Duplication Classification
Every duplication finding in production, test, benchmark, and tooling code MUST be classified as D1 (exact), D2 (structural), D3 (semantic), or D4 (intentional).

#### Scenario: Finding is classified
- **WHEN** a duplication is identified during the audit
- **THEN** it carries exactly one D1–D4 classification and a rationale

#### Scenario: No unexplained D1/D2 remains
- **WHEN** the audit completes
- **THEN** no D1/D2 duplication in production code is left unexplained

### Requirement: Ownership of Duplicated Responsibility
Consolidation MUST respect semantic ownership: domain-specific helpers stay with their owning capability and only domain-neutral infrastructure moves to `shared`.

#### Scenario: Domain logic is not moved to shared
- **WHEN** a helper is used by multiple pillars but contains domain semantics
- **THEN** it remains inside its owning pillar

#### Scenario: Consolidation preserves behavior
- **WHEN** duplicated code is consolidated
- **THEN** observable behavior, error semantics, state transitions, persistence semantics, token accounting and benchmark semantics are unchanged
