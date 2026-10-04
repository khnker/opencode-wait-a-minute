# WAM Audit Evidence Reports

## ADDED Requirements

### Requirement: Reports SHALL be generated per project

For each audited project the system SHALL produce exactly one Markdown report.

#### Scenario: One report per project
- GIVEN N audited projects
- WHEN reports are generated
- THEN N report files exist, one per project.

### Requirement: Reports SHALL contain mandatory sections

Each report SHALL contain coverage, verdict summary, per-task table, per-task evidence detail, methodology and reproduction sections.

#### Scenario: Mandatory sections present
- GIVEN a generated report
- WHEN it is inspected
- THEN all mandatory sections are present and non-empty when data exists.

### Requirement: Every verdict SHALL be traceable to evidence

Each verdict SHALL cite at least one source. Citations SHALL follow a fixed two-form grammar:

- Files: `path:line` (an absolute path followed by a colon and a 1-based line number), e.g. `/home/nicolas/dev/wait-a-minute-plugin/.wam/tasks/ses-TESTTEST01/state.yaml:14`.
- Database records: `<table>#<id>` where `<table>` is the table name and `<id>` is the row id, e.g. `part#prt_a1b2c3`, `session#ses_abcdef0123456789`, `requirement#req-1`.

No other citation formats SHALL be emitted. Every verdict object MUST contain at least one evidence entry with a source matching one of these two forms; otherwise the verdict is rendered `UNKNOWN` and the absence of evidence is stated explicitly.

#### Scenario: Verdict without evidence
- GIVEN a verdict with no available evidence
- WHEN the report is rendered
- THEN the verdict is rendered `UNKNOWN` and the absence of evidence is stated.

### Requirement: Reports SHALL surface false success and orphans

Reports SHALL explicitly list false-success tasks and orphan tasks or sessions.

#### Scenario: False success listed
- GIVEN at least one `FALSE_SUCCESS` verdict
- WHEN the report is rendered
- THEN it appears in the verdict summary and in the per-task detail.

#### Scenario: Orphans listed
- GIVEN an orphan task or session
- WHEN the report is rendered
- THEN it appears in the coverage section with its reason.

### Requirement: Reports SHALL redact secrets

Secret-like values SHALL NOT appear in reports.

#### Scenario: Token-like value
- GIVEN evidence containing a token-like value
- WHEN the report is rendered
- THEN the value is redacted.

### Requirement: Rendering SHALL be deterministic

Identical audit JSON SHALL produce byte-identical Markdown.

#### Scenario: Byte-identical reruns
- GIVEN identical audit JSON
- WHEN rendered twice
- THEN outputs are byte-identical.

### Requirement: A global index SHALL aggregate results

The system SHALL produce a global index aggregating verdict counts, coverage and links per project.

#### Scenario: Index aggregation
- GIVEN reports for several projects
- WHEN the index is generated
- THEN it lists each project with its verdict counts and report link.

### Requirement: Reproduction SHALL be documented

The exact command and inputs required to regenerate the reports SHALL be documented in the index and in each report.

#### Scenario: Reproduce from scratch
- GIVEN a clean checkout and the audit JSON
- WHEN the documented command runs
- THEN it regenerates reports byte-identically.
