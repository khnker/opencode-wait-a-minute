# Proposal: Artifact Outcome Benchmark

## Why

WAM claims that artifact-producing operations (`create-artifact`,
`update-artifact`) complete with verifiable outcomes, but there is no
deterministic harness that proves the claim. Existing benchmarks measure
token/latency economics; none measure **outcome correctness**: did the
artifact land, with the exact expected content, in an isolated
repository, identically under baseline execution and WAM execution?

## What Changes

- Add `benchmarks/artifact-outcome/` — a deterministic benchmark
  harness with four parts:
  - `fixtures.mjs` — repository fixture isolation under the OS temp
    dir (`wam-artifact-outcome-*`), with escape-safe writes and
    cleanup that refuses non-fixture paths.
  - `baseline.mjs` — baseline execution runner: applies declared
    artifact operations directly, no WAM state.
  - `wam-runner.mjs` — WAM execution runner: same declared
    operations routed through an event-sourced execution loop with
    create/update guards (`artifact-created`, `artifact-updated`,
    `artifact-create-rejected`, `artifact-update-rejected`).
  - `verifier.mjs` — independent verifier: reads the filesystem
    itself and checks outcome contracts for `create-artifact` and
    `update-artifact` (existence, exact content, content change,
    isolation).
  - `run-benchmark.mjs` — orchestrates baseline vs WAM per
    scenario on separate fixtures, verifies both, emits a
    deterministic report (no timestamps, no durations).
- Add `tests/artifact-outcome-benchmark.test.mjs` — unit tests for
  verifier/runner/fixture modules and integration tests for the
  end-to-end benchmark report (determinism, agreement, isolation).

## Non-goals

- No real-provider runs, no LLM calls, no network.
- No token/latency measurement (covered by existing benchmarks).
- No changes to the WAM runtime itself — this is a measurement
  harness, not a behavior change.

## Expected Result

`node benchmarks/artifact-outcome/run-benchmark.mjs` exits 0 with a
report where every scenario verifies `ok` for both runners and
baseline/WAM agree. Two consecutive runs produce byte-identical
reports.

## Validation

- [ ] `npm test` passes including the new
      `tests/artifact-outcome-benchmark.test.mjs`
- [ ] `node benchmarks/artifact-outcome/run-benchmark.mjs` exits 0
      with all scenarios verified
- [ ] Repeated runs produce identical reports (determinism)
- [ ] Fixture cleanup never touches non-fixture paths

## Program

- Priority: P1
- Tracks: outcome-based completion evidence (RC1 line)
