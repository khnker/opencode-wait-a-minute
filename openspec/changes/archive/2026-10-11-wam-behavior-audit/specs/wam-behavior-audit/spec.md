# WAM Behavior Audit

## ADDED Requirements

### Requirement: Audit SHALL be read-only

The audit SHALL NOT modify `.wam` state, task artifacts, the OpenCode database, or any source repository.

#### Scenario: Database is opened read-only
- GIVEN an existing OpenCode database
- WHEN the audit runs
- THEN the database is opened in read-only mode
- AND no write, journal, or lock file is created by the audit.

#### Scenario: WAM state is unchanged
- GIVEN `.wam` task directories
- WHEN the audit completes
- THEN file hashes and mtimes under `.wam` are unchanged.

### Requirement: Audit SHALL discover all WAM roots

The audit SHALL discover every `.wam` root under a configurable root path.

#### Scenario: Multiple projects
- GIVEN several project directories containing `.wam`
- WHEN discovery runs
- THEN each `.wam` root is enumerated with its project path and task list.

### Requirement: Audit SHALL ingest WAM task state tolerantly

The audit SHALL read `state.yaml` and task artifacts, tolerating missing or malformed content without aborting.

#### Scenario: Malformed state file
- GIVEN a task whose `state.yaml` is unparsable
- WHEN ingestion runs
- THEN the task is recorded as corrupt with a reason
- AND the run continues and exits 0.

### Requirement: Audit SHALL ingest the OpenCode database read-only

The audit SHALL introspect and read the OpenCode persistence tables required for correlation.

#### Scenario: Schema introspection
- GIVEN the OpenCode database
- WHEN ingestion runs
- THEN available tables and required columns are detected
- AND missing optional tables degrade gracefully.

### Requirement: Audit SHALL include archived tasks

The audit SHALL also scan archived tasks in `.wam/history/<YYYY-MM-DD>/<taskId>/`, mark them `archived:true`, and SHALL NOT double-count a task that also exists under `.wam/tasks/`.

#### Scenario: Archived tasks included without double-count
- GIVEN live tasks under `.wam/tasks/<taskId>/`
- AND archived tasks under `.wam/history/<YYYY-MM-DD>/<taskId>/`
- AND at least one `taskId` present in both locations
- WHEN the audit runs
- THEN archived-only tasks are included and marked `archived:true`
- AND a `taskId` present in both locations is counted once
- AND live copies are not marked `archived:true`.

### Requirement: Audit SHALL correlate tasks and sessions with explicit confidence


Every correlation SHALL record its method and confidence, and unmatched items SHALL be reported as orphans.

#### Scenario: Exact suffix match
- GIVEN a taskId `ses-<suffix>` and a session id ending with `<suffix>`
- WHEN correlation runs
- THEN the pair is matched with method `exact` and highest confidence.

#### Scenario: Orphan task
- GIVEN a `.wam` task with no matching session
- WHEN correlation runs
- THEN the task is reported as an orphan with a reason.

### Requirement: Audit SHALL assess direction consistency

The audit SHALL compare recorded strategy against the originating objective and emit a direction verdict with cited evidence.

Evidence citations SHALL use a fixed two-form grammar:

- Files: `path:line` (an absolute path followed by a colon and a 1-based line number), e.g. `/home/nicolas/dev/wait-a-minute-plugin/.wam/tasks/ses-TESTTEST01/state.yaml:14`.
- Database records: `<table>#<id>` where `<table>` is the table name and `<id>` is the row id, e.g. `part#prt_a1b2c3`, `session#ses_abcdef0123456789`, `requirement#req-1`.

No other citation formats SHALL be emitted. Every verdict object MUST contain at least one evidence entry with a source matching one of these two forms.

#### Scenario: Recorded direction present and consistent
- GIVEN an originating objective and a non-empty `approvedStrategy`
- WHEN direction is assessed
- THEN a verdict in {ALIGNED, WEAK, DIVERGENT} is emitted with cited fields.

#### Scenario: No recorded direction
- GIVEN a task with no strategy or plan recorded
- WHEN direction is assessed
- THEN verdict `NO_STRATEGY` is emitted.

### Requirement: Audit SHALL assess execution completion and detect false success

The audit SHALL determine whether execution completed and SHALL flag completion claims unsupported by evidence.

#### Scenario: False success detection
- GIVEN `phase == DONE` with no supporting evidence or continued post-DONE activity
- WHEN completion is assessed
- THEN verdict `FALSE_SUCCESS` is emitted.

#### Scenario: Verified completion
- GIVEN `phase == DONE` with verified requirements and evidence
- WHEN completion is assessed
- THEN verdict `COMPLETED` is emitted.

### Requirement: Audit SHALL assess retry-until-objective

The audit SHALL count failure->retry cycles and determine whether the objective was reached.

#### Scenario: Retry then success
- GIVEN at least one failed hypothesis followed by a completed objective
- WHEN retry is assessed
- THEN verdict `RETRIED_AND_SUCCEEDED` is emitted.

#### Scenario: Retry without success
- GIVEN repeated failed hypotheses with no completed objective
- WHEN retry is assessed
- THEN verdict `RETRIED_AND_FAILED` or `LOOPED_NO_PROGRESS` is emitted.

### Requirement: Audit SHALL emit deterministic machine-readable output

The audit SHALL emit per-project and aggregate JSON with stable ordering, independent of wall-clock or filesystem enumeration order.

#### Scenario: Byte-identical reruns
- GIVEN identical inputs
- WHEN the audit runs twice
- THEN both JSON outputs are byte-identical.

### Requirement: Audit SHALL expose a documented CLI contract

The audit SHALL provide a CLI with a root flag, an output root flag, an optional project filter, and deterministic exit codes.

#### Scenario: Successful run
- GIVEN valid inputs
- WHEN the CLI runs
- THEN it writes outputs and exits 0.

#### Scenario: Fatal configuration error
- GIVEN an invalid root path
- WHEN the CLI runs
- THEN it exits non-zero with an actionable message.
