## ADDED Requirements

### Requirement: Prompt-quality suites are versioned and validated
The benchmark SHALL evaluate versioned scenario suites where every
scenario has an id, suite, severity, context, promptRef, criteria, and
expectation, and every criterion has an id, kind, required flag, and
check.

#### Scenario: duplicate scenario id is rejected (PQ-001)
- **GIVEN** a suite (or dataset) containing two scenarios with the same id
- **WHEN** `validateSuite` / `validateDataset` is called
- **THEN** validation throws a `PromptEvalSchemaError` whose message names
  the duplicate id (and, across a dataset, both owning suites)

#### Scenario: missing mandatory criterion field is rejected (PQ-002)
- **GIVEN** a scenario with a criterion missing a mandatory field
  (`id`, `kind`, `required`, or `check`)
- **WHEN** `validateScenario` is called
- **THEN** validation throws an error naming the missing field; the
  criterion is never silently skipped

#### Scenario: required scenarios exist with severity and criteria
- **GIVEN** the shipped suites `verify`, `scope`, `simplify`, `delegation`
- **WHEN** the dataset is validated
- **THEN** scenarios `verify.false-done` (critical),
  `verify.environment-failure` (high), `scope.requirement-conflict`
  (high), `simplify.coupling-tradeoff` (medium), and
  `delegation.missing-evidence` (critical) exist, each carrying
  must / must-not criteria as specified in the acceptance table

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
The benchmark SHALL run its evaluation path with no API keys and no
network, and SHALL produce byte-identical serialized run cores for
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
