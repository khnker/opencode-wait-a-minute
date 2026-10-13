## MODIFIED Requirements

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

## ADDED Requirements

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
