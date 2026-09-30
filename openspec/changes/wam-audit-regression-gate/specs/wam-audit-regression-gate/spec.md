# WAM Audit Regression Gate

## ADDED Requirements

### Requirement: Gate mode SHALL fail on threshold violations

Running `scripts/wam-audit.mjs --gate` SHALL exit `2` when any configured threshold is violated and SHALL exit `0` otherwise.

#### Scenario: Threshold violation exits 2

- GIVEN current audit totals that exceed at least one gate threshold
- WHEN `scripts/wam-audit.mjs --gate` runs
- THEN the process exits `2`
- AND the aggregate JSON includes `gate.passed` as `false` and a non-empty `gate.violations` list.

#### Scenario: Clean run exits 0

- GIVEN current audit totals within every configured threshold
- AND no baseline regression
- WHEN `scripts/wam-audit.mjs --gate` runs
- THEN the process exits `0`
- AND the aggregate JSON includes `gate.passed` as `true` and an empty `gate.violations` list.

### Requirement: Thresholds SHALL be configurable

Gate thresholds SHALL be read from `--config FILE` or `.wam-audit.config.json`. Keys SHALL be `maxNoStrategyRatio` (default 0.9), `maxLoopedNoProgress` (default 0), and `maxAmbiguousMatches` (default 50).

#### Scenario: Defaults apply when no config is present

- GIVEN no `--config` flag and no `.wam-audit.config.json` in the cwd
- WHEN `--gate` evaluates totals
- THEN thresholds are `maxNoStrategyRatio=0.9`, `maxLoopedNoProgress=0`, and `maxAmbiguousMatches=50`.

#### Scenario: Config file overrides defaults

- GIVEN a JSON config file with one or more of `maxNoStrategyRatio`, `maxLoopedNoProgress`, `maxAmbiguousMatches`
- WHEN `--gate --config FILE` runs
- THEN the provided keys replace the corresponding defaults
- AND omitted keys keep their defaults.

#### Scenario: Cwd config file is used without --config

- GIVEN `.wam-audit.config.json` in the cwd
- AND no `--config` flag
- WHEN `--gate` runs
- THEN thresholds are loaded from that file.

### Requirement: Baseline regression SHALL fail the gate

`--baseline FILE` SHALL fail the gate when NO_STRATEGY, LOOPED_NO_PROGRESS, RETRIED_AND_FAILED or ambiguousMatches increase vs baseline.

#### Scenario: Increase vs baseline is a violation

- GIVEN a baseline file with prior totals for `NO_STRATEGY`, `LOOPED_NO_PROGRESS`, `RETRIED_AND_FAILED`, and `ambiguousMatches`
- AND the current run has a strictly greater value for at least one of those metrics
- WHEN `scripts/wam-audit.mjs --gate --baseline FILE` runs
- THEN the process exits `2`
- AND `gate.violations` names each metric that increased.

#### Scenario: Equal or improved metrics pass baseline comparison

- GIVEN a baseline file
- AND current `NO_STRATEGY`, `LOOPED_NO_PROGRESS`, `RETRIED_AND_FAILED`, and `ambiguousMatches` are each less than or equal to the baseline
- AND no absolute threshold is violated
- WHEN `--gate --baseline FILE` runs
- THEN the process exits `0`.

### Requirement: Gate result SHALL be machine-readable and audit SHALL stay read-only

The aggregate JSON SHALL contain `gate: { passed, violations }`. The audit SHALL NOT write to `.wam` state or the OpenCode database.

#### Scenario: Aggregate JSON includes gate object

- GIVEN a `--gate` run
- WHEN the aggregate JSON is written or printed
- THEN it contains a `gate` object with boolean `passed` and array `violations`.

#### Scenario: Gate run does not mutate WAM state or DB

- GIVEN existing `.wam` directories and an OpenCode database
- WHEN `--gate` completes (pass or fail)
- THEN no files under `.wam` are created or modified
- AND the database is not opened for write.
