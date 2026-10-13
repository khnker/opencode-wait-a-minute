# artifact-outcome-benchmark Specification

## Purpose
TBD - created by archiving change artifact-outcome-benchmark. Update Purpose after archive.
## Requirements
### Requirement: Deterministic Benchmark Report
- The benchmark harness MUST produce a report containing no
  timestamps and no durations
- Two consecutive runs over the same scenarios MUST serialize to
  identical JSON
- The report MUST include per-scenario baseline and WAM results
  and an explicit baseline/WAM agreement flag

#### Scenario: Determinism
- **WHEN** `runBenchmark()` is invoked twice with the same scenarios
- **THEN** both reports serialize to identical JSON
- **AND** `deterministic` is `true`

#### Scenario: Report shape
- **WHEN** the benchmark runs the default scenarios
- **THEN** the report names `artifact-outcome-benchmark`
- **AND** every scenario carries `baseline.verification`,
  `wam.verification`, and `agreement`

### Requirement: Repository Fixture Isolation
- Every benchmark arm MUST run on its own fixture under the OS
  temp dir tagged `wam-artifact-outcome-`
- Writes MUST be constrained to the fixture root (path-escape
  attempts are refused)
- Cleanup MUST refuse non-fixture paths
- The real repository content MUST never be touched

#### Scenario: Tagged fixture creation
- **WHEN** a fixture repository is created
- **THEN** its path is under the OS temp dir and contains
  `wam-artifact-outcome-`

#### Scenario: Escape refusal
- **WHEN** a write targets a path outside the fixture root
- **THEN** the write is refused with an error

#### Scenario: Cleanup safety
- **WHEN** cleanup is invoked on a non-fixture path
- **THEN** cleanup is refused with an error

### Requirement: Independent Outcome Verification
- Verification MUST read the fixture filesystem directly, not
  runner state
- `create-artifact` verification MUST check: artifact exists,
  content matches declared bytes, no unexpected artifacts,
  expected artifact present
- `update-artifact` verification MUST additionally check the
  content changed from the base content

#### Scenario: Correct create-artifact verifies
- **WHEN** the fixture holds exactly the declared artifact with
  the declared bytes
- **THEN** verification returns `ok: true` with all checks passing

#### Scenario: Missing artifact fails
- **WHEN** the declared artifact is absent from the fixture
- **THEN** verification returns `ok: false` with
  `artifact-exists` failing

#### Scenario: Tampered content fails
- **WHEN** the artifact bytes differ from the declared content
- **THEN** verification returns `ok: false` with
  `content-matches` failing

#### Scenario: Update without change fails
- **WHEN** an update-artifact leaves the base content in place
- **THEN** verification returns `ok: false` with
  `content-changed-from-base` failing

### Requirement: Baseline vs WAM Execution Semantics
- The baseline runner MUST apply operations unconditionally and
  record the executed sequence
- The WAM runner MUST emit a sequence-numbered event stream and
  enforce artifact guards: duplicate create is rejected with
  `already-exists`, orphan update is rejected with `not-found`
- Guard rejections MUST NOT mutate the fixture

#### Scenario: Baseline applies unconditionally
- **WHEN** the baseline runner processes an update on a missing
  artifact
- **THEN** the artifact is created and the operation is recorded
  as executed

#### Scenario: WAM rejects duplicate create
- **WHEN** the WAM runner processes a create for an existing
  artifact
- **THEN** it emits `artifact-create-rejected` with reason
  `already-exists`
- **AND** the existing artifact content is unchanged

#### Scenario: WAM rejects orphan update
- **WHEN** the WAM runner processes an update for a missing
  artifact
- **THEN** it emits `artifact-update-rejected` with reason
  `not-found`
- **AND** no artifact file is written

