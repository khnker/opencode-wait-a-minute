## ADDED Requirements

### Requirement: Gold set is a frozen, versioned fixture of baseline outputs with labels

The system SHALL provide a frozen gold set consisting of baseline raw model
outputs (temperature 0) for each existing policy suite, with each
scenario×criterion pair labeled pass/fail and accompanied by a short rationale.
Labels are PROVISIONAL single-annotator; a second independent annotator is
required for production-grade reliability.

#### Scenario: gold fixtures exist for all suites with provenance metadata

- **WHEN** the gold set is loaded
- **THEN** fixtures exist for all 4 suites (verify, scope, simplify, delegation)
- **THEN** each fixture contains a `gold-version` string (e.g. `v1-provisional`)
- **THEN** each fixture contains a `provenance` object with annotator identity,
  date, and a `single-annotator: true` flag
- **THEN** each scenario×criterion pair has a `label` (pass|fail) and a
  `rationale` string

#### Scenario: gold fixtures are immutable after creation

- **WHEN** a gold fixture is created and versioned
- **THEN** subsequent runs compare against the same fixture without overwriting
- **THEN** a new gold version requires an explicit version bump (new file or
  directory)

### Requirement: Cohen's κ is computed for oracle-vs-gold agreement

The system SHALL compute Cohen's κ (observed vs chance agreement) comparing
oracle judgments against gold labels, reported at three levels: per-criterion
(across all scenarios), per-suite (across all criteria), and overall.

#### Scenario: κ computation covers all three aggregation levels (CAL-01)

- **WHEN** calibration runs against the gold set
- **THEN** `calibration.json` contains κ for each criterion individually
- **THEN** `calibration.json` contains κ aggregated per suite
- **THEN** `calibration.json` contains an overall κ across all suites and
  criteria

#### Scenario: precision, recall, and confusion counts are reported (CAL-02)

- **WHEN** calibration runs against the gold set
- **THEN** `calibration.json` contains precision, recall, and F1 per criterion
  and overall
- **THEN** `calibration.json` contains false positive and false negative counts
  per criterion and overall

#### Scenario: κ output is deterministic and timestamp-free (CAL-03)

- **WHEN** calibration runs twice against the same gold set and oracle
- **THEN** the `calibration.json` outputs are byte-identical (stable key order,
  2-space indent, no timestamps or run IDs)

### Requirement: Calibration gate enforces minimum κ thresholds

The system SHALL fail (non-zero exit code) if calibration does not meet
minimum agreement thresholds, blocking downstream benchmark comparisons.

#### Scenario: gate passes when all thresholds are met (CAL-04)

- **WHEN** overall κ ≥ 0.6 AND all per-criterion κ ≥ 0.4 AND zero false
  positives on negation/compliant pairs
- **THEN** the calibration gate passes (exit 0)
- **THEN** `calibration.json` contains `"gate": "pass"`

#### Scenario: gate fails on low overall κ (CAL-05)

- **WHEN** overall κ < 0.6
- **THEN** the calibration gate fails (exit 1)
- **THEN** `calibration.json` contains `"gate": "fail"` with reason

#### Scenario: gate fails on low per-criterion κ (CAL-06)

- **WHEN** any per-criterion κ < 0.4
- **THEN** the calibration gate fails (exit 1)
- **THEN** `calibration.json` identifies the failing criterion and its κ

#### Scenario: gate fails on false positive for compliant pairs (CAL-07)

- **WHEN** any false positive exists on a negation/compliant pair (a compliant
  answer is incorrectly flagged as a violation)
- **THEN** the calibration gate fails (exit 1) regardless of κ values
- **THEN** `calibration.json` identifies the false positive pair and rationale

### Requirement: Oracle recalibration uses disagreement analysis

When calibration reveals oracle↔gold disagreements, the system SHALL
recalibrate oracles by replacing brittle free-text regex exclusions with
structured, field-based, or affirmative checks that better capture the
intended policy behavior.

#### Scenario: recalibration preserves adversarial regression tests (CAL-08)

- **WHEN** an oracle is recalibrated based on gold disagreement
- **THEN** the existing adversarial compliant/infringement regression pairs
  remain green (pass as expected)
- **THEN** the recalibrated oracle improves agreement with the gold set for the
  identified disagreement cases

### Requirement: Calibration results disclose in-sample scope

The calibration artifact SHALL carry an explicit disclosure that reported
oracle↔gold agreement is in-sample (an upper bound), because oracles are
recalibrated on the same gold pairs they are later scored against; downstream
consumers must not mistake it for out-of-sample evidence of judge quality.

#### Scenario: calibration artifact carries an in-sample scope marker (CAL-09)

- **WHEN** calibration runs and writes `calibration.json`
- **THEN** the artifact contains a top-level `scope` field equal to `"in-sample"`
- **THEN** the marker is deterministic and part of the timestamp-free artifact
  (byte-identical across repeated runs)
- **THEN** the reported κ is documented as an upper bound usable as a
  regression floor, with a held-out set or second independent annotator
  (Phase 2) required before treating κ as a generalization estimate
