# Spec: Runtime hygiene

## ADDED Requirements

### Requirement: Bounded logs

WAM logs MUST rotate at 5 MB and test runs MUST NOT write to the project
`.wam` log.

#### Scenario: Log rotation

- **GIVEN** a `plugin.log` larger than 5 MB
- **WHEN** the next log line is written
- **THEN** the old file is renamed to `plugin.log.1`
- **AND** the new file starts empty

#### Scenario: Test isolation

- **GIVEN** the test runner spawns a suite
- **WHEN** the suite logs
- **THEN** the output goes to a temp file and logging is disabled

### Requirement: CQE telemetry is best-effort

An unwritable telemetry store MUST NOT fail a CQE query.

#### Scenario: Read-only telemetry

- **GIVEN** `telemetry.ndjson` is not writable
- **WHEN** CQE records an execution
- **THEN** the query still returns results
- **AND** no `EACCES` error is surfaced

### Requirement: Word-boundary skill matching

Skill keywords MUST match whole words, not substrings.

#### Scenario: archivos is not arch

- **GIVEN** the prompt contains "archivos"
- **WHEN** skills are routed
- **THEN** a skill whose keyword is "arch" is not selected

### Requirement: Contract synthesis preserves meaning

Contract requirements MUST be split by sentence, keep their original verb and
MUST NOT add a duplicate verb prefix.

#### Scenario: Prose prompt

- **GIVEN** a two-sentence analysis prompt with commas
- **WHEN** the contract is synthesized
- **THEN** the requirements are the two sentences
- **AND** no fragment such as "Como corregirlo" becomes a requirement
- **AND** `nextActionFrom` does not produce "Implementar Implementar: ..."

### Requirement: Recent changes are bounded

`recent-changes.md` MUST keep at most 50 sections.

#### Scenario: Many changes

- **GIVEN** 60 recent changes
- **WHEN** they are recorded
- **THEN** the file contains at most 50 sections

### Requirement: Aggregate handles live task schema

The runner aggregate MUST skip phase-based live task files and MUST still
fail loud on a real unknown status.

#### Scenario: Phase-based task

- **GIVEN** a task file with `phase` and no `status`
- **WHEN** the aggregate is loaded
- **THEN** the task is skipped without throwing

#### Scenario: Invalid status

- **GIVEN** a task file with `status: "NOPE"`
- **WHEN** the aggregate is loaded
- **THEN** loading throws an invalid-status error

### Requirement: One-use artifacts can be archived

The system MUST provide a dry-run/apply command that moves benchmark and test
task artifacts and their snapshots out of the active `.wam` directories without
touching real user tasks.

#### Scenario: Prune test artifacts

- **GIVEN** a test task (`cg-*`) and a real task
- **WHEN** `scripts/prune-wam-artifacts.mjs --apply` runs
- **THEN** the test task and its snapshot are archived
- **AND** the real task remains in `.wam/tasks`

