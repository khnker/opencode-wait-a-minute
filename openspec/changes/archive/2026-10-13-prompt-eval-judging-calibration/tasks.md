## 1. Capture and freeze gold raw outputs

- [x] 1.1 Run baseline arm (active prompts, temperature 0) against all 4 suites
  (verify, scope, simplify, delegation) and capture raw model outputs
- [x] 1.2 Freeze outputs as immutable JSON fixtures under
  `benchmarks/quality/prompt-eval/gold/v1-provisional/` with version metadata
- [x] 1.3 Label each scenario×criterion pair as pass/fail with a short
  rationale; document as PROVISIONAL single-annotator

## 2. Implement Cohen's κ calibration tool

- [x] 2.1 Implement `benchmarks/quality/prompt-eval/calibrate.mjs`: compute
  Cohen's κ (per-criterion, per-suite, overall), precision, recall, F1, and
  confusion counts comparing oracle judgments vs gold labels
- [x] 2.2 Implement `scripts/prompts-calibrate.mjs` entry point that runs
  calibration, writes deterministic `calibration.json` (stable key order,
  2-space indent, no timestamps)
- [x] 2.3 Handle edge cases: zero-denominator κ, missing gold labels, empty
  suites

## 3. Add calibration gate

- [x] 3.1 Implement gate logic: fail (non-zero exit) if overall κ < 0.6,
  any per-criterion κ < 0.4, or any false positive on negation/compliant pairs
- [x] 3.2 Gate writes `"gate": "pass"|"fail"` with reasons to `calibration.json`
- [x] 3.3 Integrate gate into existing benchmark CI pipeline

## 4. Recalibrate oracles from disagreement analysis

- [x] 4.1 Run calibration tool against current oracles and gold set; identify
  all false positives and false negatives
- [x] 4.2 Replace brittle `excludes-any` free-text regex with structured,
  field-based, or affirmative oracle patterns for each disagreement
- [x] 4.3 Verify existing adversarial compliant/infringement regression tests
  remain green after recalibration
- [x] 4.4 Re-run calibration; confirm gate passes with improved κ values

## 5. Validation and documentation

- [x] 5.1 Write tests for κ computation (known-agreement fixtures, edge cases)
- [x] 5.2 Write tests for gate logic (pass/fail boundary conditions)
- [x] 5.3 Update `openspec validate --changes --strict` to pass
- [x] 5.4 Document gold set provenance, single-annotator limitation, and
  Phase 2 plan (second independent annotator)
