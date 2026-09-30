# Benchmarks

Development-only measurement tooling. Not part of the published npm package.

## Layout

```text
benchmarks/
├── scenarios/   scenario definitions (objective, expected work, verification)
├── fixtures/    deterministic recorded execution traces
├── runners/      execution engines (trace-replay, real-model)
├── analyzers/    measurement + statistics
├── reporters/    JSON/Markdown report generation
├── charts/       SVG chart generation
└── results/      generated evidence (gitignored)
```

## Run

```bash
npm run benchmark        # deterministic trace replay -> benchmarks/results/<timestamp>/
node --test benchmarks/token-savings-benchmark.test.mjs
```

Each run writes `raw.json`, `summary.json`, `report.md` and `charts/*.svg`.

## Methodology

Token counts are derived from **recorded per-turn execution traces**, never from
scenario constants. Baseline and WAM traces represent equivalent tasks; the only
intended difference is the presence or absence of WAM. Negative savings are valid
evidence and are never clamped to zero.

## Deterministic validation evidence
The validation suite is the CI-facing evidence layer. It exercises the causal metrics
(`simulateWorkloadMatrix` → `computeCausalMetrics`) and the snapshot-state matrix
(`runSnapshotStateValidation`), then renders a report plus four charts. It makes **no
network calls** — every input is a local, hard-coded model, so a run is reproducible on any
machine and safe to diff in CI.

### Running it
```bash
npm run bench:validation                  # writes benchmarks/results/<timestamp>/
npm run bench:validation -- --out /tmp/wam-val   # explicit output dir
npm run test:validation                   # node --test benchmarks/validation/*.test.mjs
```
Each run writes into its own directory:
```
<outDir>/
  raw.json                                     # machine-readable causal + snapshot evidence
  report.md                                    # composition, derived metrics, per-scenario table
  charts/rebuild-vs-token.svg                  # rebuild count vs total tokens, per scenario
  charts/savings-by-scenario.svg               # per-scenario reduction % (negatives included)
  charts/continuation-scaling.svg              # turns 1/3/5/10/20, baseline vs WAM tokens
  charts/snapshot-state.svg                    # VALID / STALE / INVALID counts
```

### Workload composition
Four families cover the efficiency envelope:
| Family | Role |
| --- | --- |
| `local` | single-turn, small scope — the baseline efficiency case |
| `contextual` | project-level context that must be re-read when it changes |
| `continuation` | 1/3/5/10/20-turn sessions, where avoided rebuilds compound |
| `negative` | negative control that **must** cost more (see below) |

### How to interpret the evidence
**Snapshot classifications.** The snapshot-state matrix seeds an isolated project root per
case, creates a baseline snapshot, applies exactly one mutation, and asserts the
classification, the changed signals and the resulting rebuild scope.
- `VALID` — the snapshot still matches git, project context and task state. The turn runs on
  the **fast path**: no reconstruction at all, so `rebuildInvoked` is `false`.
- `STALE` — something *outside* the task state moved (git revision, relevant files). Context
  is still usable, so a **partial** rebuild is sufficient.
- `INVALID` — the task state itself moved (phase/contract change), or the snapshot is
  malformed / schema-incompatible. A **full** rebuild is mandatory; the fast path must never
  be reachable here.

**Fast path vs partial vs full.** These are the three rebuild scopes, and they are the
mechanism behind every token delta: `fastPathCount` is avoided work, `partialRebuildCount` is
bounded rework, `fullRebuildCount` is the fallback. The continuation family is where the effect
compounds — the baseline pays one full reconstruction per turn while WAM keeps taking the fast
path, so `continuation-scaling.svg` shows the gap widening with turn count.

**The negative control.** `negative-1` is expected to **increase** cost, and it reports a
negative savings value as a result. That negative number is the point: it proves the
measurement is sensitive in both directions. A harness that clamped savings to `>= 0` would
render the negative control indistinguishable from a neutral scenario and would go blind to
real regressions. Negative results are therefore preserved everywhere — per-scenario table,
derived totals and chart dataset — and `savingsByScenarioSvg` fits its axis to `[min, max]`
so negative bars get their own downward extent instead of being flattened onto the zero line.
Each chart also carries a `data-series` attribute with the exact plotted (signed) values so the
assertion is a data check, not a pixel check.

**Determinism and no-network guarantees.** The workload matrices contain no timestamps, no RNG
draws and no provider calls. The timestamp in the default output directory name is the only
wall-clock use, and it never reaches `raw.json`, `report.md` or the SVGs — two runs produce
byte-identical artifacts. Snapshot validation runs in a temp root created and removed by the
runner, and `assertNoFalseValid` fails the run if any mutated case is classified `VALID`.

## Claims policy

Every measurement is classified as one of:

- `observed` — reported directly by the provider or execution trace
- `measured` — calculated from captured execution data
- `derived` — calculated from measured values
- `estimated` — inferred using a declared estimator

Estimated values are never presented as observed.

## Real-model execution

Opt-in only (`WAM_BENCH_REAL_MODEL=1`). No provider adapter is wired yet; the
deterministic trace replay is what CI executes.

## Out of scope

The context-selection benchmark (`context-benchmark.mjs`,
`context-benchmark-router.mjs` and their tests) is a separate evaluation harness.
It is pinned by `scripts/production-gate.mjs` and is intentionally **not** migrated
in this change to avoid a blind mass migration.
