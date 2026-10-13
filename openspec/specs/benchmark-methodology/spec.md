# benchmark-methodology Specification

## Purpose
TBD - created by archiving change rc1-15-benchmark-methodology-freeze. Update Purpose after archive.
## Requirements
### Requirement: Benchmark Methodology Freeze
Deterministic and live-provider benchmark results MUST be separated and MUST carry full provenance.

#### Scenario: Separation holds
- **WHEN** benchmark results are produced
- **THEN** deterministic and live figures are never merged

#### Scenario: Provenance present
- **WHEN** a result is emitted
- **THEN** it contains commit, version, scenario, token fields, equivalent and provider/model when applicable

### Requirement: Experimental variants are versioned without changing active prompts
Policy variants SHALL live under `prompts/experiments/<policy>/<variant>.md`
with `status: experimental`, and the active prompts
(`prompts/policies/*.md`, `prompts/injections/delegation.md`) SHALL remain
unchanged. The prompt catalog loader SHALL ignore `prompts/experiments/**`.

#### Scenario: variants exist and active catalog is unchanged (PQ-EXP-06)
- **GIVEN** the experimental variants for verify, scope, simplify and delegation
- **WHEN** the prompt catalog is loaded
- **THEN** the active prompt count is unchanged and no experimental variant is
  exposed as active

### Requirement: Experiments compare runs with identical suite, configuration and coverage
A baseline/candidate comparison SHALL use the same suite id/version,
configuration hash and scenario/criterion coverage. Runs that differ SHALL be
rejected rather than compared.

#### Scenario: mismatched experiment run is rejected (PQ-EXP-07)
- **GIVEN** a baseline and a candidate with different suite versions, config
  hashes or coverage
- **WHEN** they are compared
- **THEN** the comparison is rejected with a descriptive error

### Requirement: A critical regression vetoes a candidate regardless of token savings
A candidate that introduces a critical regression SHALL be rejected even if it
reduces tokens or latency.

#### Scenario: cheaper candidate with a critical regression is rejected (PQ-EXP-08)
- **GIVEN** a candidate that saves tokens but fails a critical scenario
- **WHEN** the experiment decision is computed
- **THEN** the candidate is rejected as a regression

### Requirement: The promotion decision is documented with residual uncertainty
The experiment SHALL record which variant wins, which loses, and what
uncertainty remains. No variant SHALL be promoted to active within this change.

#### Scenario: decision record names winner, loser and uncertainty (PQ-EXP-09)
- **GIVEN** a completed comparison round
- **WHEN** the decision is reported
- **THEN** it names the winning and losing variants, states residual uncertainty,
  and confirms no active prompt was modified

