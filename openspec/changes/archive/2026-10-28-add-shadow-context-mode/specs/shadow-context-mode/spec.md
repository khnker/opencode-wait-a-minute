## ADDED Requirements

### Requirement: Projection mode selection
The system SHALL resolve a single `contextProjection` config key to one of `legacy`,
`shadow` or `active`, using `active` when the key is unset or invalid.

#### Scenario: Default mode
- **WHEN** no `contextProjection` is configured
- **THEN** the resolved mode is `active` and compaction behavior is unchanged

#### Scenario: Explicit modes
- **WHEN** `contextProjection` is `legacy`, `shadow` or `active`
- **THEN** the resolver returns that exact mode

#### Scenario: Invalid mode
- **WHEN** `contextProjection` holds an unknown value
- **THEN** the resolver returns `active` and emits one diagnostic through the caller hook

### Requirement: Shadow mode preserves legacy output
In `shadow` mode the system SHALL inject the legacy brief byte-for-byte and SHALL NOT
let projection output reach the injected context.

#### Scenario: Byte-identical injection
- **WHEN** compaction runs in `shadow` mode
- **THEN** the injected context equals the context injected in `legacy` mode for the
  same state

#### Scenario: Active mode unaffected
- **WHEN** the mode is `active`
- **THEN** the projection-backed brief is injected as before and no shadow record is written

### Requirement: Shadow telemetry record
In `shadow` mode the system SHALL append one JSON object per line to
`context-shadow.jsonl` under `WAM_METRICS_DIR` or the project `.wam` directory, capped
at approximately 1 MB / 500 lines, containing both hashes, character and token counts,
`deltaChars`, `equivalent`, requirement, decision, constraint and retrievable-ref
summaries.

#### Scenario: Record appended
- **WHEN** compaction completes in `shadow` mode
- **THEN** exactly one record is appended with `schemaVersion`, `timestamp`,
  `sessionId`, `taskId`, `mode`, `budgetChars`, `injectedChars`, `shadowChars`,
  `injectedHash`, `shadowHash`, both token estimates, `deltaChars`,
  `requirements`, `decisions`, `constraints`, `retrievableRefs` and `equivalent`

#### Scenario: Deterministic record
- **WHEN** the record builder receives the same inputs and a fixed clock
- **THEN** it returns an identical record

### Requirement: Shadow telemetry is fail-soft
Telemetry errors SHALL NOT throw, alter or prevent the injected context.

#### Scenario: Unwritable destination
- **WHEN** the metrics directory cannot be written
- **THEN** the append is skipped and compaction still injects the legacy brief
