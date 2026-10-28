# Delta for shadow-context-mode

## ADDED Requirements

### Requirement: Shadow records declare projection availability

Every shadow record SHALL carry `projectionAvailable: boolean` and
`fallbackReason: string | null`. `projectionAvailable` SHALL be `true` only when
a semantic projection was actually built; otherwise it SHALL be `false` and
`fallbackReason` SHALL be a non-empty string.

#### Scenario: Projection present
- **WHEN** a shadow record is built from a non-null projection
- **THEN** `projectionAvailable` is `true` and `fallbackReason` is `null`

#### Scenario: Projection absent
- **WHEN** a shadow record is built without a projection and a fallback reason
- **THEN** `projectionAvailable` is `false` and `fallbackReason` carries that reason

#### Scenario: Projection absent without an explicit reason
- **WHEN** a shadow record is built without a projection and without a reason
- **THEN** `fallbackReason` is `projection-unavailable`

### Requirement: Fallback reason is reported by the brief

`buildContextBrief` SHALL report a fallback reason when it runs with
`projectionMode: "active"` and no execution ledger and no canonical base are
available. It SHALL return `fallbackReason: "no-ledger-and-no-base"` while
keeping the brief text identical to the legacy output. A record built from that
brief SHALL NOT claim projection counts as if a projection had run.

#### Scenario: Missing ledger and base
- **WHEN** the brief is built in active mode with no ledger and no base
- **THEN** the result has `projection: null` and
  `fallbackReason: "no-ledger-and-no-base"`
- **AND** the text is byte-identical to legacy mode

### Requirement: Promotion minimum counts only available projections

The report gate SHALL apply `--min-records` only to records whose
`projectionAvailable` is exactly `true`. Records with `false` (fallback) or a
missing field (pre-migration/unknown) SHALL be counted separately and SHALL
NEVER satisfy the minimum.

#### Scenario: Enough available records
- **WHEN** the file contains at least `min-records` available records
- **THEN** the records gate passes

#### Scenario: One fallback shortens the available count
- **WHEN** the file contains `min-records - 1` available records plus one fallback record
- **THEN** the records gate fails and its detail names the shortfall

#### Scenario: All fallback
- **WHEN** every record has `projectionAvailable: false`
- **THEN** the records gate fails even when the total count meets the minimum

#### Scenario: Unknown legacy records
- **WHEN** records omit `projectionAvailable`
- **THEN** they are classified as unknown and do not satisfy the minimum

### Requirement: Gate reports availability without changing exit codes

The report SHALL print available, fallback and unknown counts. Exit codes SHALL
remain `0` for pass, `1` for gate failure and `2` for missing or unreadable
telemetry.

#### Scenario: Availability summary
- **WHEN** the report runs on a parseable file
- **THEN** it prints an availability line with available, fallback and unknown counts

#### Scenario: Missing telemetry
- **WHEN** the telemetry file does not exist
- **THEN** the process exits `2`

### Requirement: Legacy telemetry remains parseable

Existing telemetry files without the new fields SHALL stay parseable and SHALL
be treated as `unknown`, never as available.

#### Scenario: Pre-migration file
- **WHEN** a parseable record has no `projectionAvailable` field and unrelated extra fields
- **THEN** parsing succeeds, the record is counted as unknown and the report does not crash
