# Benchmark Limitations

Everything below is a known constraint on interpreting the RC1 numbers. Read this
before quoting any figure from `benchmarks/reports/rc1/`.

## Provider dependencies

- **The `real` suite never talks to a real model by default.** Via the unified
  CLI, `--suite=real` calls `runDryRun()`, which uses the in-file mock provider
  (`createMockProvider()`). Token counts are simulated.
- The mock provider reports `model: "mock/dry-run"`. Any number derived from it
  describes the simulation, not a hosted model's behaviour.
- A credentialed run through `runRealSuite()` is a separate operation, is not
  invoked by the CLI, and is not reproduced in CI. Its results depend on the
  provider, the model version, and pricing at run time — none of which are
  pinned in the artifact. One such run was performed on 2026-10-07
  (`benchmarks/results/2026-10-07T19-55-09.328Z/`, provider `openai-compatible`,
  model `cost-saver`); its numbers are reported in
  [results.md](./results.md) (section B2) and carry the same caveats, including a
  missing verification signal for task-success metrics.
- **Provider pricing is never applied.** Only token counts are reported. Any
  currency figure quoted downstream is the reader's own calculation using their
  own price table.

## Model dependencies

- Results are sensitive to model version. A different checkpoint, a different
  context window, or a different tokenizer changes token counts even with
  identical inputs.
- The dry-run scenarios (RC1 scenarios) are engineering-shaped fixtures. They do
  not represent the distribution of real user tasks.

## Assumptions baked into the numbers

- **WAM overhead is counted.** The dry-run suite includes WAM's own overhead
  tokens in `wamInputTokens`. In the shipped mock configuration this overhead
  exceeds the baseline context it replaces, so `netInputSavings` is **negative**
  while the deterministic validation suite reports a **positive** reduction
  percentage. Both are correct within their own harness. They are not combined.
- `netInputSavings` is a signed difference, not a ratio. A negative value means
  WAM cost more tokens than the baseline for that configuration.
- Rebuild counts come from the harness's own classification
  (`fastPath` / `partialRebuild` / `fullRebuild`). If that classification is wrong
  for a given state transition, the counts inherit the error.
- Snapshot validation writes to a temp directory created and removed by the
  benchmark process. It never touches the live WAM runtime, so a passing result
  says nothing about behaviour under concurrent production load.

## Statistical caveats

- The dry-run suite supports `trials > 1`, but the default is a single trial.
  With one trial, **no confidence interval is meaningful** and none is reported.
- `pairedDelta` / `summarize` assume independent paired trials. Shared fixtures
  across scenarios introduce correlation that this assumption does not model.
- `EquivalenceRate` is computed over fixture-defined correctness, not over
  independent human or test-suite judgement.

## What the external evidence does and does not add

- Section C lists external sources as **mechanism precedent only**. None of them
  measured WAM.
- **Provider caching is not WAM evidence.** A cached prefix still occupies the
  context window. Cached-token savings are a billing effect. They are reported
  separately and never merged with WAM metrics.
- Academic context-compression work (e.g. token-level compressors) and WAM's
  selection mechanism operate at different granularities. Their reported
  compression ratios are **not** comparable to WAM's rebuild-avoidance counts
  without a shared task suite, which does not exist yet.

## Known `INVALID_COMPARISON` conditions

The generator flags, rather than hides:

- Runs missing token accounting for either side of the pair.
- A suite that produced no evaluations at all.
- Divergent signs between the deterministic reduction percentage and the dry-run
  `netInputSavings`.

When any of these appear, the affected figure should not be quoted without the
accompanying caveat in `comparison.json`.

## Coverage gaps

- No latency, throughput, or memory measurement.
- No currency cost.
- No real-provider verification in the reproducible path.
- No long-horizon (>5 turn) agent trajectory in the shipped dry-run scenarios.
- The evidence corpus is a curated sample, not a systematic review. It is not
  weighted or pooled, so it cannot be used to compute an aggregate external
  effect size.
