# Benchmark evidence — roadmap status

Status of the requested test/benchmark roadmap, with the exact artifacts and
numbers produced by this repository. Read alongside
[Methodology](methodology.md) and [Limitations](limitations.md); the
non-negotiable rules in [README](README.md) still apply.

Everything below is reproducible offline (`mock` provider) unless a row says
otherwise. Nothing here merges the three evidence classes.

## Reproduce

```bash
# P0-A — statistical aggregation
node --test benchmarks/real/stats.test.mjs
node --test benchmarks/real/runners/paired-runner.test.mjs
WAM_BENCH_DRY_RUN=1 node benchmarks/run-real.mjs --trials 3 --out /tmp/dry3

# P0-B — false-completion
node --test tests/e2e/false-completion-agent.test.mjs
node benchmarks/real/runners/false-completion-runner.mjs   # via test

# P0-C — long-context
node --test benchmarks/long-context.test.mjs
node benchmarks/long-context.mjs

# P1-D/E/G — isolation, restart, degradation
node --test tests/isolation/interleaved-isolation.test.mjs \
           tests/e2e/restart-recovery.test.mjs \
           tests/robustness/degradation.test.mjs

# P1-F — skill routing
node benchmarks/skill-routing.mjs
node --test tests/unit/skill-routing-accuracy.test.mjs

# P1-H — quality harness
node --test benchmarks/quality/scoring.test.mjs benchmarks/quality/run-quality.test.mjs
```

## Status

| # | Roadmap item | Class | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1 | P0 A/B multi-trial aggregation | internal deterministic | READY | `benchmarks/real/stats.mjs`, `stats.test.mjs` (5/5) |
| 2 | P0 multi-trial reproducibility (`--trials`) | internal deterministic | READY | `run-real.mjs --trials 3` → `trialStats.n = 15` |
| 3 | P0 false-completion E2E | internal deterministic | READY | `false-completion-agent.test.mjs` (4/4) |
| 4 | P0 long-context scaling | internal deterministic | READY | `long-context.test.mjs` (6/6) |
| 5 | P1 adversarial isolation | internal deterministic | READY | `interleaved-isolation.test.mjs` |
| 6 | P1 restart / recovery | internal deterministic | READY | `restart-recovery.test.mjs` |
| 7 | P1 context preservation | internal deterministic | READY (covered) | long-context + isolation suites |
| 8 | P1 skill-routing accuracy | internal deterministic | READY | `skill-routing.mjs` → accuracy 100% |
| 9 | P1 safe degradation | internal deterministic | READY | `degradation.test.mjs` |
| 10 | P1-H quality A/B judge correction | internal deterministic (mechanism) | READY (re-run pending) | `quality/scoring.test.mjs` (27/27) |
| 11 | P2 WAM vs alternatives | — | ABSENT | no competing-harness suite |
| 12 | P2 real cost ($) | — | DEFERRED | see note below |

Combined offline test result for the suites above: **17/17** (isolation +
restart + degradation + skill routing + false-completion) and **72/72** for the
benchmark suite bundle (stats, paired-runner, quality, long-context,
token-savings, cli).

## Details

### 1–2. P0-A — multi-trial A/B aggregation

`benchmarks/real/stats.mjs` exposes `mean`, `median`, `p95`, `stddev`, `ci95`
(returns `{mean, low, high, n}`). `aggregateTrials` in
`benchmarks/real/runners/paired-runner.mjs` summarizes each metric with those
helpers; `benchmarks/run-real.mjs` now parses `--trials N` /
`WAM_BENCH_TRIALS` and attaches a `trialStats` block to the report.

Dry-run with `--trials 3` over 5 RC1 scenarios (15 scenario-trials, 90 runs):

```
trialStats.n = 15
baselineInput  {mean 39,   median 6,  p95 151, stddev 58.7}
wamInput       {mean 84,   median 14, p95 280, stddev 106.9}
netSavingsPct  {mean -165.75, median -180, p95 -85.43, stddev 56.7}
contextRebuilds{mean 6,    median 1,  p95 20,  stddev 7.6}
stateEquivalentRate {mean 1, median 1, p95 1, stddev 0}
```

> The negative `netSavingsPct` is the mock provider measuring tiny scenarios;
> it matches the shipped `netInputSavings: -225` dry-run figure in
> [README](README.md) rule 4 and must not be combined with the 69.6%
> deterministic reduction.

### 3. P0-B — false-completion

Three trap scenarios where an agent claims completion while a criterion is
unmet. `baselineFalseCompletion` counts claims a naive self-verification
accepts; `wamFalseCompletion` counts claims the WAM completion gate lets
through.

```
baselineFalseCompletion: 3
wamFalseCompletion:      0
correctCompletion:       3
```

The gate blocks every premature completion in the corpus while still accepting
the three correct ones.

### 4. P0-C — long-context scaling

Accumulated history of N WAM turns; baseline concatenates the full raw history,
WAM assembles a budgeted context. `contextReductionPct =
(baseline - wam) / baseline * 100`.

| turns | baselineInputTokens | wamInputTokens | reduction % | rebuilds |
| --- | --- | --- | --- | --- |
| 5 | 42 | 33 | 21.43 | 1 |
| 10 | 90 | 34 | 62.22 | 1 |
| 25 | 233 | 34 | 85.41 | 1 |
| 50 | 470 | 34 | 92.77 | 1 |
| 100 | 996 | 34 | 96.59 | 1 |

WAM input stays bounded (33–34 tokens) while baseline grows linearly.

### 5–7, 9. P1 — isolation, restart, context preservation, degradation

`tests/isolation/interleaved-isolation.test.mjs` drives interleaved sessions
(A→B→C→A→C→B→A) and asserts no cross-session leakage;
`tests/e2e/restart-recovery.test.mjs` kills and respawns a real child process
and asserts state recovery; `tests/robustness/degradation.test.mjs` feeds
malformed events, corrupted state, and failed reconstruction and asserts the
pipeline degrades safely. Combined: **12/12** pass.

### 8. P1-F — skill-routing accuracy

`benchmarks/scenarios/skill-routing.mjs` defines a 7-case corpus with
`expected` (must-select) and `forbidden` (cross-domain leak) skills. The runner
drives the real `analyze` pipeline and reports precision/recall/F1. Latest run:

```
accuracy=100.0%  recall=100.0%  precision=100.0%  f1=100.0%
```

### 10. P1-H — quality A/B judge correction

The quality harness pairs a baseline arm (raw context) against a WAM arm
(assembled context) over the same prompts. The deterministic fact score is a
tie, but a real-provider run on 2026-10-08 showed the LLM judge scoring WAM
**55** vs baseline **83.33** (delta **−28.33 pp**). Inspection showed the judge
was penalizing WAM's chain-of-thought verbosity, not factual coverage:
*"The response rambles through a thought process without providing a clear
final answer."*

Corrections:

- `extractFinalAnswer()` in `benchmarks/quality/scoring.mjs` isolates the
  committed answer (text after the last `FINAL ANSWER:` marker; whole text
  when absent).
- `benchmarks/quality/run-quality.mjs` appends an identical `FINAL ANSWER:`
  instruction to **both** arms and scores/judges the extracted answer.
- `benchmarks/quality/judge.mjs` now instructs the judge to ignore verbosity,
  length, formatting, and reasoning text.

Unit coverage: **27/27** (`scoring.test.mjs` + `run-quality.test.mjs`). The
corrected judge delta has **not** been re-measured with a live provider in this
change; the deterministic fact delta remains 0.

### 11. P2 — WAM vs alternatives

No harness exists that runs a competing context strategy (e.g. naive
truncation, summarization) on the same task suite. This is a genuine gap, not a
measured result.

### 12. P2 — real cost ($)

Deferred. [README](README.md) rule 5 states *"Provider pricing is never
applied. Only token counts are reported."* A dollar-cost calculator would
contradict that governance, so no pricing code is added; token counts
(`baselineInputTokens`, `wamInputTokens`, `totalTokens`) are the currency-free
figures to quote.

## Caveats

- Rows 1–9 are **internal deterministic** measurements. They do not prove a
  real-model saving.
- The false-completion and long-context figures use the mock provider and
  synthetic contexts; they demonstrate mechanism, not production rates.
- The quality judge correction changes the harness, so pre- and post-fix judge
  scores are not directly comparable.
- Provider caching, latency, and memory are still unmeasured (see
  [Limitations](limitations.md)).
