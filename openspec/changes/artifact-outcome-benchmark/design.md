# Design: Artifact Outcome Benchmark

## Context

The plugin ships benchmark infrastructure for token/latency
economics (`benchmarks/run.mjs`, `benchmarks/validation/*`) but
nothing measures whether artifact-producing operations actually
complete with verifiable outcomes. WAM's core claim — outcome-based
done with evidence-backed completion — needs a deterministic,
provider-free proof: the same declared operations, executed by a
baseline runner and by the WAM-style runner, land on the filesystem
in an isolated repository and satisfy the same outcome contract.

## Goals / Non-Goals

Goals:
- Deterministic: no timestamps, no durations, no randomness —
  byte-identical reports across runs.
- Independent: the verifier reads the filesystem directly, never
  runner state or runner-provided "evidence".
- Isolated: every arm runs on its own tagged fixture under the OS
  temp dir; escapes and non-fixture cleanup are refused.

Non-goals:
- No real providers, LLM calls, or network.
- No token/latency measurement (existing benchmarks own that).
- No changes to the WAM runtime itself.

## Architecture

```
benchmarks/artifact-outcome/
  fixtures.mjs     fixture roots (temp dir, tagged), safe writes/cleanup
  baseline.mjs     control arm: unconditional apply, executed sequence
  wam-runner.mjs   WAM arm: event-sourced loop with artifact guards
  verifier.mjs     independent outcome contracts (create/update)
  run-benchmark.mjs orchestrator: per-scenario arms, report, CLI
tests/artifact-outcome-benchmark.test.mjs   unit + integration
```

Data flow per scenario:
1. Create two fixtures: `wam-artifact-outcome-baseline-<id>-*` and
   `wam-artifact-outcome-wam-<id>-*`.
2. Seed both with the scenario base state (if any).
3. Run baseline on one fixture, WAM on the other.
4. Verify both fixtures independently against the declared
   operations.
5. Record `agreement` (baseline.ok === wam.ok).
6. Clean up both fixtures (in `finally`).

The verifier derives expectations from the declared operations —
the same source the runners consume — so a doctored runner cannot
pass by self-attesting.

## Key Decisions

- **Terminal-state verification.** `verifyScenario` verifies the
  last declared operation (the terminal fixture state) rather than
  every intermediate step; intermediate correctness is covered by
  the runners' own unit tests. Rationale: keeps the harness simple
  while still proving the outcome contract end-to-end.
- **Guard asymmetry as the signal.** Baseline applies unconditionally
  (plain filesystem semantics); WAM rejects duplicate creates and
  orphan updates. The benchmark proves the WAM guard event stream
  is emitted and that rejections do not mutate the fixture.
- **No-unexpected-artifacts check.** Prevents runners from "verifying"
  by littering the fixture; only the declared artifact may exist
  under `artifacts/`.
- **Sequence-only event numbering.** Events carry `seq` only, so the
  WAM event stream and the whole report are stable across runs.

## Risks / Trade-offs

- Terminal-state verification would miss an intermediate mutation
  that is later corrected. Accepted: intermediate steps are unit
  tested, and the harness's purpose is outcome proof, not trace
  proof.
- Fixture roots live in the shared OS temp dir; concurrent runs
  could observe each other's tagged directories. Mitigated by
  `mkdtemp` uniqueness and by cleanup accounting tests that only
  assert count restoration after a complete run.

## Migration / Rollout

None — additive harness and tests only. No runtime, schema, or
package-surface changes (benchmarks are already excluded from
`npm pack` via `!**/bench-*.mjs`; the new directory is not part of
the shipped `files` list).
