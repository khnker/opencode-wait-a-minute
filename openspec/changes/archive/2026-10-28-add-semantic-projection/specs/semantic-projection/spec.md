## ADDED Requirements

### Requirement: Semantic projection from structured state

The system SHALL build a compaction projection from structured task state (task/contract,
execution ledger, decisions, canonical base, applicable constraints) without reading the
transcript, and SHALL render it with bounded sections.

#### Scenario: Projection derives from the execution ledger

- **WHEN** a task has an execution ledger with pending requirements and an evidence conflict
- **THEN** the projection lists the pending obligations, the conflict and the next obligation
- **AND** evidence appears as refs only, never as full text

#### Scenario: Only live decisions are projected

- **WHEN** decisions include accepted/approved and rejected/superseded/invalidated entries
- **THEN** only accepted/approved decisions appear in the projection

#### Scenario: Missing structured state keeps the legacy brief

- **WHEN** no execution ledger and no canonical base are available
- **THEN** `buildContextBrief` returns the legacy brief unchanged

#### Scenario: Projection failure degrades silently

- **WHEN** projection construction throws
- **THEN** the brief falls back to the legacy output and does not throw

#### Scenario: Output is bounded and deterministic

- **WHEN** the projection is rendered with `maxChars`
- **THEN** the rendered text never exceeds the cap
- **AND** repeated builds with the same inputs produce identical output
- **AND** items omitted by caps are listed as retrievable refs

#### Scenario: Priority selection survives the requirement cap

- **WHEN** an execution ledger holds more than ten requirements and the pending or evidence-bearing ones sort last
- **THEN** requirements referenced by pending obligations or conflicts are selected first
- **AND** non-verified and evidence-bearing requirements follow, up to the cap
- **AND** dropped requirement ids remain listed as retrievable refs
