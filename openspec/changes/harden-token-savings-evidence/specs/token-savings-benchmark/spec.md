# token-savings-benchmark — delta

## ADDED Requirements
### Requirement: Savings require a measured baseline
The meter SHALL report `savingsPct`/`savingsTokens` only when the baseline is
measured. Synthetic baselines SHALL be recorded with source `synthetic`,
`savingsPct: null`, `savingsTokens: 0`, and the raw `deltaTokens`.
#### Scenario: Synthetic baseline
- **WHEN** no measured baseline is supplied
- **THEN** the record has `baselineSource: "synthetic"`, `savingsPct: null`, `savingsTokens: 0`
- **AND** `deltaTokens` keeps the signed difference
#### Scenario: Measured baseline
- **WHEN** the caller supplies `baselineTokens`
- **THEN** the record has `baselineSource: "measured"` and a numeric `savingsPct`

### Requirement: Provider usage required for claims
A savings claim SHALL require provider-reported usage for the request AND a
measured baseline. Otherwise the record SHALL have `claimable: false` and
`savingsPct: null`.
#### Scenario: Provider usage captured
- **WHEN** an assistant message reports `tokens.input`
- **THEN** the session usage stores `requestTokens = input + cache.read`
#### Scenario: No provider usage
- **WHEN** usage is unavailable
- **THEN** `claimable` is false and `savingsPct` is null

### Requirement: Estimator provenance
Every record SHALL store the estimator name and any calibrated `charsPerToken`.
#### Scenario: Estimator recorded
- **WHEN** a record is written
- **THEN** `estimator` is present (default `chars/4`)

### Requirement: Bounded metrics storage
The metrics file SHALL retain at most `maxRecords` records (default 1000) and
SHALL be written atomically.
#### Scenario: Overflow
- **WHEN** a record is appended and the file exceeds `maxRecords`
- **THEN** the oldest records are appended to `token-savings-archive.jsonl`
- **AND** removed from the active file
