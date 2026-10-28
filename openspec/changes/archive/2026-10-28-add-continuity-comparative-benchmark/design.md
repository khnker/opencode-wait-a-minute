# Design — comparative semantic-continuity benchmark

## Baseline record

- Evaluated commit: `60a19c3` (2026-10-28). Note: the request assumed `d7e943b`;
  the actual HEAD at evaluation time was `60a19c3`.
- Working tree: dirty, containing the phase 1–7 changes (not committed).
- Node `v24.16.0`, npm `11.13.0`.
- Budget: 4000 characters (~1000 tokens) per strategy.
- Release gate: `npm run validate` PASS, RC1 READY (0 skipped).
- Existing benchmark: `benchmarks/semantic-continuity.test.mjs` compares only
  legacy-vs-WAM on 8 structural probes.

## Research links

- W3C PROV-DM, provenance model for "what happened / what was derived from
  what": https://www.w3.org/TR/prov-dm/
- Long-context degradation ("lost in the middle"): https://arxiv.org/abs/2307.03172
- BM25 lexical retrieval baseline: https://en.wikipedia.org/wiki/Okapi_BM25

## What "task success" means here

"Task success" is defined as **the information required for the task survives
selection**. Probes ask whether an id, constraint, evidence ref or negative
guarantee is present in the selected context. Model comprehension of that
context is deliberately out of scope and deferred to shadow mode; this benchmark
isolates the selection layer.

## Alternatives

**A — live agent runs with an LLM judge.** Rejected for now: cost per run,
non-deterministic judging, flaky CI signal, and no reproducible baseline.

**B — token-savings-only benchmark.** Rejected: it rewards dropping content and
says nothing about whether the dropped content was required. A smaller brief
that loses a mandatory constraint must score worse, not better.

**C — deterministic three-strategy simulation over the real modules (chosen).**
Same fixture, same budget, same probes; each strategy is a pure function of the
same ledger/base/decisions. Reproducible, network-free, and it can express
negative guarantees (superseded/invalidated/hypothesis must not survive).

## Strategies

- `full`: render every collected item in insertion order, truncate at 4000.
  Reference baseline with no curation.
- `top-k`: term-overlap scoring (BM25-lite) against objective + constraints,
  top 8 items, deliberately status-blind: it does not know superseded,
  invalidated or hypothesis status.
- `wam`: `buildContextBrief(...)` with the real semantic projection.

## Metrics

`continuity/10`, `mandatoryLost`, `briefTokens`, `recoveryTokens`,
`totalTokens = briefTokens + recoveryTokens`, and informational `selectMs`
(measured with `process.hrtime.bigint`, never asserted).

## Discriminating assertions

WAM must score 10/10 with zero mandatory loss and be a strict superset of both
naive strategies on the status-aware probes (superseded decision, hypothesis,
invalidated fact). `full` and `top-k` must each fail at least one deliberate
failure case; otherwise the benchmark is not measuring curation, only recall.
