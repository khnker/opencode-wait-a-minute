# Benchmarks

RC1 benchmark suite for the **opencode-wait-a-minute** (WAM). It compares a
baseline LLM context (full transcript re-injection) against the WAM runtime
context graph and reports token savings, latency, and correctness parity.

## What RC1 measures

The RC1 scenario set exercises five end-to-end shapes:

| scenario | purpose |
|---|---|
| `local` | single-turn, no upstream context |
| `contextual` | mid-sized requirement set, baseline-friendly |
| `continuation` | 20-turn session to surface cumulative token savings |
| `mutation` | requirement revisions mid-session (control over fast path) |
| `negative-control` | overhead probe with no shared context |

Each turn is run on two arms:

- **baseline** — full transcript plus task prompt, no WAM intervention.
- **wam** — runtime context graph plus task prompt, with the standard
  `assembly.js` / `context-snapshot.js` flow.

Per-turn metrics: prompt tokens (baseline vs. wam), WAM overhead tokens,
fast-path hit, model output tokens, wall time. Per-pair metrics: paired delta
of `baseline.input − wam.effectiveInput` aggregated across scenarios.

## Reproduce

### Dry-run (no API required)

The dry-run mode uses an in-process mock provider so the full harness can be
exercised without network access. It is what CI runs.

```bash
node benchmarks/run-real.mjs --dry-run --out <dir>
```

Optional flags actually implemented by `run-real.mjs`:

- `--ablation` — sweeps every ablation variant defined in
  `benchmarks/evaluation/ablation.mjs`. Each ablation result is written into
  `report.ablation[]` and the manifest `ablations[]` block.
- `--out <dir>` — overrides the default `benchmarks/results/dry-run-<ts>`.

`WAM_BENCH_DRY_RUN=1` is equivalent to `--dry-run`.

Outputs written into `<dir>`:

- `summary.json` — raw `runRealSuite` payload (results, evaluations, metrics).
- `real-report.json` — `buildRealReport` output (`runs`, `pairs`,
  `totals`, `statistics`, optional `ablation`).
- `manifest.json` — `rc1-evidence-manifest@1` evidence manifest with sha256
  of `real-report.json` (built by `benchmarks/reporters/manifest.mjs`).

### Real provider run (not run by CI)

```bash
export WAM_BENCH_BASE_URL=<openai-compatible endpoint>
export WAM_BENCH_API_KEY=<key>
export WAM_BENCH_MODEL=<model-id>
node benchmarks/run-real.mjs --out <dir>
```

If `WAM_BENCH_BASE_URL` is not set, `run-real.mjs` exits early with a hint
message and writes nothing. Real-mode invocation uses
`resolveProvider()` from `benchmarks/providers/index.mjs`.

## Reading `real-report.json`

Top-level shape:

```
{
  version, model, provider, mode, timestamp,
  runs: [...],          // per-turn normalized entries
  pairs: { <pairId>: { baseline, wam } },
  totals: { wamInputTokens, baselineInputTokens, trials, ... },
  statistics: { baselineInputTokens, wamEffectiveInput, ... },
  evaluations: [...],   // success criteria per turn
  metrics: { ... },     // aggregate metrics
  ablation?: [...],     // only present when --ablation
  evidence: { execution, tokens, correctness, mechanism }
}
```

Key fields:

- `runs[]` — every per-turn pair. Each entry has `arm`, `scenario`, `turn`,
  `baselineInputTokens`, `inputTokens`, `wamOverheadTokens`,
  `fastPathHit`, `latencyMs`, etc.
- `pairs` — pairId → `{ baseline, wam }` token totals.
- `totals.trials` — number of distinct pairIds (matches `pairs` length).
- `statistics` — `pairedDelta`/`summarize` output: mean / stddev / n for
  every aggregate metric.
- `evidence` — evidence category. See `DETERMINISTIC_EVIDENCE` vs
  `EMPIRICAL_EVIDENCE` in `benchmarks/reporters/claims.mjs`.

Evidence categories:

- **DETERMINISTIC_EVIDENCE** — dry-run path. `execution: deterministic_simulation`,
  `tokens: simulated`, `correctness: fixture_defined`, `mechanism: measured`.
- **EMPIRICAL_EVIDENCE** — real provider path. `execution: provider_execution`,
  `tokens: observed`, `correctness: verified`, `mechanism: measured`.

## Reading `manifest.json`

The manifest pins the run to a specific commit and a specific report
artifact:

```
{
  schema: "rc1-evidence-manifest@1",
  generatedAt, repoCommit, mode, provider, model,
  evidenceCategory,
  counts: { runs, trials, pairs },
  ablations: [...],     // only when --ablation
  statistics, claims,
  artifacts: [{ path, bytes, sha256 }],
  limitations: [...]
}
```

`artifacts[].sha256` lets a downstream verifier detect any tampering with
`real-report.json` between emission and archival.

## Running the RC1 test set

```bash
node --test benchmarks/reporters/manifest.test.mjs
node --test benchmarks/reporters/claims.test.mjs
node --test benchmarks/evaluation/statistics.test.mjs
node --test benchmarks/evaluation/ablation.test.mjs
node --test benchmarks/runners/paired-session.test.mjs
node --test benchmarks/providers/providers.test.mjs
```

Individual benchmark files (e.g. `ablation.test.mjs`,
`paired-session.test.mjs`) cover the per-module invariants of RC1.

## Limitations

- Dry-run results are deterministic simulations, not real model executions.
  Use them to validate the harness, not to claim token savings against a
  production LLM.
- Real provider runs require API credentials and are **not** reproduced by
  CI. The CI pipeline emits deterministic manifests; manual re-runs with
  provider credentials produce `EMPIRICAL_EVIDENCE`-tagged reports.
- Statistical significance assumes independent paired trials. The default
  RC1 sweep uses one trial per scenario; rerun with multiple trials for
  any statistical claim beyond a smoke test.
- `netInputSavings` and `breakEvenTurn` are computed from the input-token
  side only; they do not account for differences in output tokens or
  provider-side billing.
- Evidence manifests only cover artifacts emitted by `run-real.mjs`. Other
  benchmark outputs (e.g. the legacy `benchmarks/run.mjs` HTML reports) are
  not yet pinned by a manifest.