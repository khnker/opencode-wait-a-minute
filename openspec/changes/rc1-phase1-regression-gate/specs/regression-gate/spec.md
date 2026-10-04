# Spec: RC1 Phase 1 — Regression & Test Gate

## Requirements
- The release gate must execute all classification categories and exit non-zero on any failure.
- State isolation must ensure no cross-test pollution in `.wam`.
- Completion, lifecycle, continuation, admission, evidence, and persistence regressions must be fully covered by automated assertions.
