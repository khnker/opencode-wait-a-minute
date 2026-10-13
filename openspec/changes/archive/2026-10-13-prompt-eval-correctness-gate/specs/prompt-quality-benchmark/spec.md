## ADDED Requirements

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
