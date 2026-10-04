# Benchmark Methodology

What the RC1 benchmarks measure, what they deliberately do not, and how to
reproduce each number.

## What IS measured

### Snapshot correctness (internal, deterministic)

A matrix of snapshot-state cases is run against a temp root created and destroyed
by the benchmark process. Each case declares whether it mutates state, what the
expected outcome is, and whether a rebuild was invoked. `runSnapshotStateValidation()`
asserts there are **no false-valid** results: a case that reports `valid` when it
should not is treated as a hard failure, not a rounding error.

### Fast-path and rebuild avoidance (internal, deterministic)

Every turn is classified as `fastPath`, `partialRebuild`, or `fullRebuild`. The
suite reports the counts and the resulting total reduction percentage over a
simulated workload matrix. These are **accounting** metrics: they measure what
WAM decided to do, not what a model produced.

### Token accounting (empirical, dry-run)

Paired baseline/WAM runs over the RC1 scenarios record `inputTokens`,
`totalTokens`, `contextRebuilds`, and `fastPathCount` per run. Summing the paired
runs yields the totals reported in section B. `netInputSavings` is
`baselineInputTokens - wamInputTokens`; it is **signed** and is allowed to be
negative when WAM overhead exceeds the context it replaces.

### Outcome equivalence (empirical, dry-run)

Each scenario turn is evaluated for task success and for baseline/WAM
equivalence. The report prints `outcomeMatch` as a count out of the number of
evaluations, never as a percentage mixed with token figures.

## What is NOT measured

- **Real model behaviour.** The `real` suite via the unified CLI calls
  `runDryRun()`, which uses the in-file mock provider. Token counts are
  simulated, not produced by a hosted model. No network call is made.
- **Latency or throughput.** Not measured anywhere in the RC1 bundle.
- **Cost in currency.** Not computed. Token counts are reported; pricing is not
  applied, because pricing changes and would make artifacts non-reproducible.
- **Cached tokens.** See below.
- **Anything about provider-side caching.** Not a WAM metric.

## The caching rule

Provider prompt caching (OpenAI, Anthropic `cache_control`) reduces the **price
per token** for a reused prefix. It does **not** reduce the number of tokens the
model reads, nor the effective context window. A cached prefix is still attended
to.

Therefore cached-token figures are reported **only** in section C (external
evidence), with an explicit caveat, and are **never** merged with, substituted
for, or averaged into WAM's internal or empirical numbers. `comparison.json`
carries `merged: false` and a `mergePolicy` string, both asserted by tests.

## Why the two internal harnesses may disagree

`run-validation.mjs` and `run-real.mjs` are separate experiments with separate
inputs:

- The validation suite models context selection over a synthetic workload matrix.
- The dry-run suite runs the mock provider over the RC1 scenarios.

A positive reduction in one and a negative `netInputSavings` in the other is
expected and is reported as such. The generator emits an `INVALID_COMPARISON`
issue when the signs diverge, and the report states that no single net-savings
number is claimed. This is intentional: collapsing them into one headline
number would be a methodological error.

## Reproducibility

Every artifact carries a `sha256` in `manifest.json`, so a published bundle can
be verified byte-for-byte.

```bash
node benchmarks/cli.mjs --suite=all --out=/tmp/rc1-run
node benchmarks/reports/generate-rc1.mjs --out=/tmp/rc1-report

# verify one artifact against the manifest
node -e "const c=require('node:crypto'),f=require('node:fs');\
const m=JSON.parse(f.readFileSync('/tmp/rc1-report/manifest.json'));\
for(const a of m.artifacts){\
  const h=c.createHash('sha256').update(f.readFileSync('/tmp/rc1-report/'+a.path)).digest('hex');\
  console.log(a.path, h===a.sha256?'OK':'MISMATCH');}"
```

Determinism notes:

- The deterministic and validation suites contain no RNG and no `Date.now()`
  inside the evidence. The timestamp is used **only** to name the output
  directory.
- The dry-run suite uses the mock provider, so token counts are stable across
  runs on the same code.
- The report's `generatedAt` varies between runs; the hashes of `raw.json`,
  `metrics.json`, `comparison.json`, `evidence.json` and `report.md` are
  therefore stable but the `manifest.json` hash of itself is not computed.

## Classification of external evidence

See `benchmarks/evidence/methodology.md` for the full taxonomy
(`provider | academic | open-source | independent`), the inclusion criteria, and
the confidence weighting rule. In short: external sources are **context**, never
a pooled quantitative input.
