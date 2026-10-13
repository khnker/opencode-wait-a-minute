# prompt-quality-benchmark Specification

## Purpose
TBD - created by archiving change prompt-quality-benchmark. Update Purpose after archive.
## Requirements
### Requirement: Prompt-quality suites are versioned and validated
The benchmark SHALL evaluate versioned scenario suites where every
scenario has an id, suite, severity, context, promptRef, criteria, and
expectation, and every criterion has an id, a `required` flag, a
non-evaluated human `description`, and a structured observable `oracle`
(a `kind` plus a non-empty `values` array).

#### Scenario: duplicate scenario id is rejected (PQ-001)
- **GIVEN** a suite (or dataset) containing two scenarios with the same id
- **WHEN** `validateSuite` / `validateDataset` is called
- **THEN** validation throws a `PromptEvalSchemaError` whose message names
  the duplicate id (and, across a dataset, both owning suites)

#### Scenario: missing mandatory criterion field is rejected (PQ-002)
- **GIVEN** a scenario with a criterion missing a mandatory field
  (`id`, `required`, `description`, or a well-formed `oracle`)
- **WHEN** `validateScenario` is called
- **THEN** validation throws an error naming the missing/invalid field; the
  criterion is never silently skipped

#### Scenario: required scenarios exist with severity and criteria
- **GIVEN** the shipped suites `verify`, `scope`, `simplify`, `delegation`
- **WHEN** the dataset is validated
- **THEN** scenarios `verify.false-done` (critical),
  `verify.environment-failure` (high), `scope.requirement-conflict`
  (high), `simplify.coupling-tradeoff` (medium), and
  `delegation.missing-evidence` (critical) exist, each carrying
  structured, observable oracle criteria

### Requirement: Prompt runs are frozen by content hash
The benchmark SHALL freeze each run by hashing prompt CONTENT so a run
record is reproducible against the exact prompt bytes it used, and so
later comparisons reference the snapshot rather than live files.

#### Scenario: prompt content change alters the hash (PQ-003)
- **GIVEN** a prompt body and its frozen hash
- **WHEN** the prompt content changes in any way
- **THEN** `hashContent` yields a different hash and the snapshot
  identifies the content as changed

#### Scenario: frozen snapshot ignores later live edits (PQ-004)
- **GIVEN** a run frozen against a prompt set
- **WHEN** the live prompt file is modified after freezing
- **THEN** comparison against the frozen run still uses the snapshot's
  stored content hashes, not the live file

### Requirement: Evaluation is deterministic and key-free
The benchmark SHALL run its evaluation path with no API keys and no network,
SHALL execute every scenario in the suite against its recorded output before
reporting metrics, and SHALL produce byte-identical serialized run cores for
identical inputs.

#### Scenario: deterministic eval completes with no API keys (PQ-INT-05)
- **GIVEN** an environment with no API keys and no network access
- **WHEN** the deterministic evaluation path runs
- **THEN** it completes, classifies every scenario, and writes the run
  artifacts under `benchmarks/quality/prompt-eval/runs/<runId>/`

#### Scenario: serialized cores are stable across repeats
- **GIVEN** two evaluations with identical inputs
- **WHEN** both run records are serialized with `serializeReport`
- **THEN** the outputs are byte-identical (no timestamps or durations
  inside the core)

### Requirement: Scenario evaluation executes against recorded outputs
`runEvaluation` SHALL evaluate every scenario using its recorded output,
record a per-criterion result (pass, fail, or not-evaluable), and derive
`metrics` and `details` from those results. A run MUST NOT report metrics
without having executed its scenarios, and a missing or empty output MUST be
treated as not-evaluable, never as a pass.

#### Scenario: run evaluates every scenario and records per-criterion results (PQ-EXEC-01)
- **GIVEN** a validated suite and recorded outputs for a label
- **WHEN** `runEvaluation` runs
- **THEN** `metrics.evaluableCount` reflects the evaluated scenarios and
  `details` contains one entry per scenario carrying its id, severity,
  pass/fail status, and the per-criterion results with evidence

#### Scenario: deliberate critical regression is detected (PQ-EXEC-02)
- **GIVEN** a baseline where a critical scenario passes
- **WHEN** the candidate output violates that scenario's mandatory criterion
- **THEN** the decision is `REGRESSION` (not `NO_CHANGE` nor `INCONCLUSIVE`)
  and the evidence names the scenario, the criterion, and the severity

#### Scenario: missing or empty output is not a pass (PQ-EXEC-03)
- **GIVEN** a scenario whose recorded output is missing or empty
- **WHEN** it is evaluated
- **THEN** its criteria are not-evaluable and no `IMPROVED` decision is produced

#### Scenario: identical outputs are equivalent (PQ-EXEC-04)
- **GIVEN** baseline and candidate with identical recorded outputs
- **WHEN** the two runs are compared
- **THEN** the decision is `NO_CHANGE`

#### Scenario: token savings cannot mask a critical regression (PQ-EXEC-05)
- **GIVEN** a candidate that consumes fewer tokens but fails a critical
  criterion that the baseline satisfied
- **WHEN** the two runs are compared
- **THEN** the decision is `REGRESSION`

### Requirement: Behavioral oracles are structured and observable
The evaluator SHALL decide each criterion from observable evidence in the
output only, using a structured oracle of kind `includes-all`,
`includes-any`, `excludes-any`, `matches`, or `not-matches`. It MUST NOT
match the human `description` text, MUST be deterministic, and MUST NOT use
the network.

#### Scenario: varied wording passes (PQ-ORACLE-01)
- **GIVEN** a criterion whose oracle is `includes-any` with several accepted
  phrasings
- **WHEN** the output uses a different accepted phrasing
- **THEN** the criterion passes, without requiring the exact rule sentence

#### Scenario: restating the rule does not comply (PQ-ORACLE-02)
- **GIVEN** a criterion and its human `description`
- **WHEN** the output repeats the description text but omits the required
  observable evidence
- **THEN** the criterion fails

#### Scenario: forbidden observable is detected (PQ-ORACLE-03)
- **GIVEN** a critical criterion with an `excludes-any` oracle
- **WHEN** the output contains a forbidden observable (e.g. a false DONE)
- **THEN** the criterion fails and the scenario is not passed

#### Scenario: regex oracle matches structured output (PQ-ORACLE-04)
- **GIVEN** a criterion with a `matches` regex oracle
- **WHEN** the output contains a matching structured fact
- **THEN** the criterion passes; a non-matching output fails

#### Scenario: insufficient evidence is not evaluable (PQ-ORACLE-05)
- **GIVEN** a criterion and an empty or missing output
- **WHEN** it is evaluated
- **THEN** the criterion is not-evaluable (never passed) and the scenario
  cannot contribute an `IMPROVED` decision

