# Design: RC1 Empirical Evidence & Execution Plan

## Blocks & Architecture
1. **Evidence Provenance**: Tag metrics as `observed`, `measured`, `derived`, `estimated`, `simulated`.
2. **Empirical Execution**: Clean adapter interface under `benchmarks/providers/`.
3. **State Equivalence**: Verify `logicalStateHash` between baseline and WAM before completion.
4. **Correctness**: Connect verification results to primary task success.
5. **Snapshot & Persistence**: Harden snapshot creation lifecycle and state persistence/restart matrix.
6. **Continuation & Paired Runs**: Empirical multi-turn execution with paired trial design.
7. **Ablation & Statistics**: Summary stats (mean, median, stddev) and capability flags.
8. **Manifest & Release**: Generate `manifest.json` and release evidence artifacts.
