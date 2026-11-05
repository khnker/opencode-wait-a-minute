## ADDED Requirements

### Requirement: Fresh isolated web verification

The system SHALL provide a repeatable script that verifies WAM against a fresh
`opencode web` process without touching the project `.wam`.

#### Scenario: Automated run

- **WHEN** the operator runs `npm run verify:web`
- **THEN** a fixture directory with its own `.wam/config.json` is created under
  the OS temp directory
- **AND** a new `opencode web` process is started on a free loopback port with
  the fixture as its working directory
- **AND** a session is created, a deterministic implement prompt is sent, and
  the contract is approved in test mode
- **AND** the script polls the task and loop state until completion, failure or
  timeout

### Requirement: Auditable evidence

The system SHALL write an audit bundle for every run.

#### Scenario: Report contents

- **WHEN** the run finishes, with or without success
- **THEN** `report.json` records the command line, Node/OpenCode/git versions,
  fixture path, server URL and PID, session IDs, timeline, final task and loop
  state, child-session summaries and check results
- **AND** `report.md` renders the same evidence with a checks table and artifact
  index
- **AND** the bundle includes redacted copies of the server log and plugin log,
  plus `task.json`, `loop-state.json`, `loop-events.jsonl` and `sessions.json`

### Requirement: Failures are diagnosed, not hidden

The system SHALL fail the run when the loop stalls, the agent pass ends without
a status, or the failure reason is an empty response without a provider cause.

#### Scenario: Stalled or empty pass

- **WHEN** the gate is inactive but `agentRun.status` is null and the task is not
  done
- **THEN** the run exits non-zero and the report marks `agent-pass-settled` as
  failed
- **WHEN** `failureReason` contains `agent response is empty`
- **THEN** the run exits non-zero and the report marks `no-empty-response` as
  failed

### Requirement: No live-state mutation

The system SHALL leave the project `.wam` untouched and clean up the fixture by
default.

#### Scenario: Durable evidence

- **WHEN** the operator runs `npm run verify:web` without `--out`
- **THEN** `report.json` and `report.md` are written under
  `openspec/evidence/web-e2e/<runId>` so the run is auditable from the repo
- **AND** `--ephemeral` writes the same files under the OS temp directory

#### Scenario: Cleanup

- **WHEN** the run ends
- **THEN** the server process is terminated
- **AND** the fixture is removed unless `--keep` is set
- **AND** the report directory is retained and its path is printed
