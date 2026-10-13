## ADDED Requirements

### Requirement: Criteria must be calibrated against a gold set before use

Each evaluation criterion SHALL have documented agreement with a frozen gold
set, measured via Cohen's κ. Criteria are considered valid for benchmark
comparison only when calibration passes the gate (overall κ ≥ 0.6, per-criterion
κ ≥ 0.4, zero false positives on negation/compliant pairs).

#### Scenario: uncalibrated criterion is flagged (PQ-CAL-01)

- **WHEN** a criterion has no calibration record in `calibration.json`
- **THEN** the criterion is marked as `uncalibrated` in run reports
- **THEN** the calibration gate fails (non-zero exit) if the criterion is
  marked required

#### Scenario: calibrated criterion reports κ and agreement metrics (PQ-CAL-02)

- **WHEN** a criterion has a calibration record
- **THEN** run reports include the criterion's κ, precision, recall, and
  false positive/negative counts alongside verdicts

#### Scenario: structured or affirmative checks are preferred over brittle regex (PQ-CAL-03)

- **WHEN** recalibrating an oracle based on gold disagreement analysis
- **THEN** the recalibrated oracle uses structured, field-based, or affirmative
  patterns rather than brittle `excludes-any` free-text regex
- **THEN** adversarial compliant/infringement regression pairs remain green
