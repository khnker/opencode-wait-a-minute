# Context Pack Contract

## ADDED Requirements

### Requirement: Context Pack Contract
Context pack assembly MUST follow tier rules and be deterministic, ordered, deduplicated and reproducible.

#### Scenario: Tier rules hold
- **WHEN** a context pack is assembled
- **THEN** N0/N2 are included when applicable, N1 by domain, N3 only when valuable

#### Scenario: Reproducible output
- **WHEN** the same input is assembled twice
- **THEN** both packs serialize identically
