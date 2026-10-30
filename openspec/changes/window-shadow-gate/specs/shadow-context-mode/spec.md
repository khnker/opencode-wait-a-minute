# Delta for shadow-context-mode

## ADDED Requirements

### Requirement: Promotion gate evaluates a window of recent projections

The shadow report SHALL evaluate `mode`, `budget`, `delta` and `selection`
over the last N records whose `projectionAvailable` is exactly `true`, where
`N` defaults to `--min-records` (20) and MAY be overridden with
`--window <n>`. The `parse` check SHALL continue to cover every line in the
telemetry file.

#### Scenario: Historical defect outside the window

- **WHEN** a telemetry file contains an over-ratio record older than the last
  N available records, and every record in the window satisfies the checks
- **THEN** the `delta` gate passes and the report MAY pass

#### Scenario: Regression inside the window

- **WHEN** any of the last N available records exceeds the allowed delta ratio
- **THEN** the `delta` gate fails and names the maximum ratio

#### Scenario: Corrupt line anywhere

- **WHEN** any line in the file is not valid JSON
- **THEN** the `parse` gate fails regardless of its position relative to the
  window

### Requirement: Window size is explicit and validated

`--window` SHALL accept only positive integers. The report SHALL print both the
total record count and the evaluated count, and the `records` gate SHALL count
the evaluated window against `--min-records`.

#### Scenario: Invalid window

- **WHEN** the CLI receives `--window 0` or a non-numeric value
- **THEN** it exits with the usage error code and does not evaluate records

#### Scenario: Report labels the evaluated set

- **WHEN** the report runs over a file with more records than the window
- **THEN** it prints `records: <total> (evaluated <n>)`
