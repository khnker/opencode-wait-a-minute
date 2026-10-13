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

### Requirement: A mandatory criterion that is not evaluable can never pass
A scenario result SHALL be `passed: true` only if it has at least one
`required: true` criterion and every `required: true` criterion is both
evaluable and passed. A required criterion that cannot be evaluated (missing
or empty output, malformed oracle, unknown kind, invalid regex) MUST force
`passed: false` and MUST NOT be excluded from the mandatory set. A scenario is
`evaluable` only when at least one of its required criteria could be evaluated,
so a scenario with no evaluable required criterion can never contribute an
`IMPROVED` decision.

#### Scenario: un-evaluable required criterion fails the scenario (PQ-CORR-01)
- **GIVEN** a scenario with a `required: true` criterion whose oracle cannot be
  evaluated and an optional criterion that passes
- **WHEN** `evaluateScenario` is called
- **THEN** the result is `passed: false` and `mandatoryPassed: false`, and the
  failing criterion's evidence names the cause (unknown kind / invalid regex)

#### Scenario: empty output is never a pass (PQ-CORR-02)
- **GIVEN** a scenario with at least one `required: true` criterion
- **WHEN** the output is missing or empty
- **THEN** the result is `passed: false` and `evaluable: false`, and it cannot
  surface as `IMPROVED`

#### Scenario: all required criteria passing yields a pass (PQ-CORR-03)
- **GIVEN** a scenario whose `required: true` criteria are all evaluable and
  passed
- **WHEN** `evaluateScenario` is called
- **THEN** the result is `passed: true` and `mandatoryPassed: true`

### Requirement: Run reports preserve per-scenario and per-criterion evidence
`report.json` SHALL contain the evaluated scenarios, and for each scenario its
id, severity, pass/evaluable status, and per-criterion verdicts
(`criterionId`, the criterion's oracle `kind`, `required`, `passed`,
`evaluable`, `evidence`). The report MUST NOT emit an empty `scenarios` array.
The serialized core (`run.json`, `report.json`) SHALL remain byte-identical
across repeats.

#### Scenario: report lists scenarios with criteria (PQ-CORR-04)
- **GIVEN** a completed run over one or more scenarios
- **WHEN** `report.json` is read
- **THEN** it lists every evaluated scenario, each with per-criterion verdicts,
  and `scenarios` is non-empty

#### Scenario: reported criterion kind is the oracle kind (PQ-CORR-05)
- **GIVEN** a criterion with an oracle of kind `excludes-any`
- **WHEN** its verdict appears in the report
- **THEN** the reported `kind` is `excludes-any` (never `undefined`), and two
  consecutive runs produce byte-identical core artifacts

### Requirement: Run comparison requires explicitly compatible runs
`compareRuns` SHALL select the label explicitly (a caller-provided label, or
the run's single label) and MUST reject, with a descriptive error, runs whose
suite id/version differ, whose config hash differs, or that do not cover the
same scenario ids with the same `required` criterion ids per scenario. It MUST
throw when the label is ambiguous rather than defaulting silently. When either
run is a partial/interrupted run (its `details` list is empty), the coverage and
criterion guards SHALL be skipped and the comparison SHALL proceed so the
decision is `INCONCLUSIVE` rather than throwing.

#### Scenario: coverage mismatch is rejected (PQ-CORR-06)
- **GIVEN** two runs where one is missing a scenario, or a required criterion of
  a shared scenario
- **WHEN** `compareRuns` is called
- **THEN** it throws an error naming the missing scenario/criterion

#### Scenario: ambiguous label is rejected (PQ-CORR-07)
- **GIVEN** a run record carrying multiple labels
- **WHEN** `compareRuns` is called without an explicit label
- **THEN** it throws an ambiguity error; with an explicit valid label it
  compares that label's snapshot

#### Scenario: incompatible suite or config is rejected (PQ-CORR-08)
- **GIVEN** two runs with different suite versions or different config hashes
- **WHEN** `compareRuns` is called
- **THEN** it throws an error naming the mismatch

#### Scenario: a partial run is inconclusive, not a mismatch (PQ-CORR-09)
- **GIVEN** a baseline run with scenario details and an interrupted candidate
  run whose `details` are empty
- **WHEN** `compareRuns` is called
- **THEN** it does not throw a coverage-mismatch error and the decision is
  `INCONCLUSIVE`

### Requirement: Negation-aware oracles avoid false positives
A `required` criterion that forbids a behavior MUST NOT fail a compliant answer
that explicitly names and rejects that behavior. Contested criteria SHALL use a
negation-aware oracle (an affirmative `not-matches` pattern) instead of a bare
literal `excludes-any` whose term can legitimately appear in a correct answer.
`excludes-any` SHALL be kept only for terms that cannot legitimately appear.

#### Scenario: compliant answer that rejects the behavior passes (PQ-EXP-01)
- **GIVEN** a corrected criterion (e.g. `verify.false-done.no-false-done`) and an
  output that states it will not claim completion without executed evidence
- **WHEN** the criterion is evaluated
- **THEN** it passes, even though the output contains the words `done`/`verified`

#### Scenario: violating answer that endorses the behavior fails (PQ-EXP-02)
- **GIVEN** the same criterion and an output that declares DONE without evidence
- **WHEN** the criterion is evaluated
- **THEN** it fails

### Requirement: Adversarial scenario pairs distinguish negation from infringement
Each contested behavior SHALL be covered by a pair of scenarios — one compliant
negation (must pass) and one infringement (must fail) — so word overlap alone
cannot decide the verdict.

#### Scenario: adversarial pair resolves both directions (PQ-EXP-03)
- **GIVEN** an adversarial pair for delegation-without-evidence
- **WHEN** both are evaluated
- **THEN** the compliant-negation scenario passes and the infringement scenario fails

### Requirement: Evaluator self-regression is tested
Every corrected criterion SHALL ship a paired regression test proving that a
compliant-negation output passes and a violating output fails, so the oracle
fix cannot silently regress.

#### Scenario: oracle fix is guarded by tests (PQ-EXP-04)
- **GIVEN** the corrected criteria from this change
- **WHEN** `node --test benchmarks/quality/prompt-eval/*.test.mjs` runs
- **THEN** each corrected criterion has a passing pair test (compliant passes, violation fails)

### Requirement: Experiment evidence is complete and reproducible
An experiment run SHALL record, per scenario and per criterion, the verdict,
plus cost (tokens, latency, execution failures) and a reproducible configuration
hash. Core artifacts SHALL remain timestamp-free and byte-identical across
repeats.

#### Scenario: evidence artifact carries verdicts, cost and config (PQ-EXP-05)
- **GIVEN** a completed experiment run
- **WHEN** its evidence is read
- **THEN** it contains per-scenario/per-criterion verdicts, cost metrics and the
  config hash, and two repeats are byte-identical

