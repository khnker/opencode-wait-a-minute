## MODIFIED Requirements

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

## ADDED Requirements

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
