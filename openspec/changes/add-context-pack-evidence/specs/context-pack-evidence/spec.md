# Context Pack Evidence

## ADDED Requirements

### Requirement: Ordered per-turn context pack archive

Every assembled context pack MUST be persisted under
`.wam/tasks/<taskId>/context/` as a zero-padded, monotonically numbered JSON
file, and the manifest `index.json` MUST list the records in the same order.

#### Scenario: First pack recorded
- **WHEN** a context pack is assembled for a task
- **THEN** `0001-<promptHash>.json` is written and `index.json` contains one entry with `seq: 1`

#### Scenario: Subsequent packs keep order
- **WHEN** a second pack is assembled for the same task
- **THEN** `0002-<promptHash>.json` is written and `index.json` entries are ordered `1, 2`

### Requirement: Full context evidence

Each record MUST contain the injected lines, the dropped items with their
reason, and the integrity report (selected/emitted/omitted counts and
sufficiency), so the archived pack can be compared against what was sent.
Each record MUST also include the candidate nodes (`id`, `type`, `content`,
`verified`) that existed before selection, including nodes the router omitted.

#### Scenario: Dropped context is auditable
- **WHEN** the budget/admission policy drops an item
- **THEN** the record's `dropped` array contains that item's reason

### Requirement: Evidence collection never breaks injection

Recording failures MUST be swallowed and reported as `{ok: false, reason}`.

#### Scenario: Unwritable archive
- **WHEN** the evidence directory cannot be written
- **THEN** `recordContextPack` returns `ok: false` and the message handler continues
