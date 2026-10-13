## ADDED Requirements

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
