# runtime-evidence — delta

## ADDED Requirements
### Requirement: Identical measurements coalesce
`recordTokenSavings` SHALL fold a measurement into the newest record when
`taskId`, `actualTokens`, `baselineTokens`, `baselineSource` and `usageSource`
are equal and the elapsed time is within `WAM_METRICS_DEDUPE_MS` (default 60000).
The coalesced record SHALL carry `occurrences`, `firstAt` and `lastAt`, and the
call SHALL return `coalesced: true`.

#### Scenario: Repeated continuation record
- **WHEN** two identical measurements are recorded within the window
- **THEN** the ledger has one row with `occurrences: 2`

#### Scenario: Window disabled
- **WHEN** `dedupeMs` is `0` or the task differs
- **THEN** a new row is appended

### Requirement: Claimable savings are reported separately
`summarizeTokenSavings(records)` SHALL return `total`, `claimableTotal`,
`claimableCount`, `unclaimableCount` and `occurrences`, summing only records
with `claimable: true` into `claimableTotal`.

#### Scenario: Mixed ledger
- **WHEN** the ledger contains claimable and synthetic records
- **THEN** `claimableTotal` excludes the synthetic `savingsTokens`
- **AND** `unclaimableCount` counts them

### Requirement: Retention preserves claimable evidence
When the ledger exceeds `maxRecords`, unclaimable records SHALL be archived and
removed before any claimable record.

#### Scenario: Bounded ledger with real evidence
- **WHEN** a claimable record and two synthetic records exist with `maxRecords: 2`
- **THEN** the claimable record stays and the oldest synthetic one is archived

### Requirement: Summary reports the last claimable measurement
`printTokenSavingsSummary` SHALL report the most recent claimable record when
one exists, even if later synthetic turns were recorded.

#### Scenario: Synthetic turn after a real measurement
- **WHEN** a claimable record is followed by an unclaimable one
- **THEN** the summary reports the claimable task's savings

### Requirement: Skill-injection cost is auditable per turn
Every context-pack evidence record SHALL include
`injection: { skills, refs }`, derived from the emitted lines: `skills` counts
`[wam N3 skill]` bodies and `refs` counts `[wam N3 skill-ref]` lines. The same
summary SHALL be mirrored in `index.json`.

#### Scenario: Deduped skill
- **WHEN** a pack emits two full skill bodies and one ref line
- **THEN** the record and the index entry both have `{skills: 2, refs: 1}`

