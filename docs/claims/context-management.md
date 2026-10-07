# Context Management

## Claim

WAM reconstructs task-relevant model context from task state instead of
continuously accumulating the full conversational context.

## Mechanism

Context selection considers the information required for the current task state.
The mechanism lives in:

- `src/context/context.js` — context capsules (`.wam/capsules/`), session
  identity (`.wam/session.json`), deterministic selection under a budget, and
  retrieval by relevance (closed alias set, no embeddings);
- `src/context/assembly.js` — context pack builder (levels N0/N1/N2; `context.js`
  handles N3);
- `src/context/context-budget-manager.js`, `src/context/context-cache.js` — budget
  and caching.

## Primary outcome

The quantitative outcome is:

```text
context reduction
=
baseline model context
-
WAM model context
```

This is a context measurement. It is not automatically a provider-cost
measurement. See [Benchmark Methodology](../benchmarks/methodology.md).

## Benchmark evidence

`benchmarks/reports/rc1/metrics.json` reports two separate classes:

- **Internal deterministic** — `totalReductionPct: 69.6` on a snapshot harness
  (no provider, no network);
- **Empirical real (dry-run)** — `contextReduction: -225`,
  `netInputSavings: -225`, i.e. WAM input exceeds baseline input under the
  shipped dry-run configuration.

The 69.6% figure is not a real-model saving. The negative dry-run result is
reported as-is and is not combined with the deterministic figure.

## Validation

The benchmark must identify:

- baseline context;
- WAM context;
- WAM overhead;
- measurement method;
- scenario;
- number of turns.

## Tests

- `tests/unit/context-assembly.test.mjs`
- `tests/unit/context-budget-manager.test.mjs`
- `tests/unit/context-minimality.test.mjs`
- `tests/unit/context-snapshot.test.mjs`
- `tests/unit/context-retrieval.test.mjs`

**Status: Measured** (deterministic harness) and **Observed** (dry-run). The
60% release threshold requires a reproducible benchmark that measures
task-relevant model context with equivalent accounting on both sides; that
remains a **Design target**.

## See also

- [Context Selection](../architecture/context-selection.md)
- [Benchmark Results](../benchmarks/results.md)
