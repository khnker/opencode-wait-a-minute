# Benchmark: Task-Conditioned Role Replacement

Evaluates `src/cognition/task-role-engine.js` selection accuracy and the
contract for replacing the injected voice/persona in context assembly when
the inferred task shape changes.

## What it measures

| Metric | Definition | Source |
|---|---|---|
| **Selection accuracy** | fraction of `(objective, requirements)` fixtures whose `selectRole().role` equals the expected role | `run-benchmark.mjs` |
| **Confidence calibration** | mean absolute deviation between `selectRole().confidence` and a hand-labeled confidence bucket {low, med, high} | `run-benchmark.mjs` |
| **Conflict resolution rate** | fraction of fixtures where the engine prefers a `-verify`/`-review`/etc. suffix signal over a conflicting free-text signal | `run-benchmark.mjs` |
| **Idempotence** | fraction of fixtures where two consecutive `selectRole` calls produce identical outputs | `run-benchmark.mjs` |

## Layout

```
benchmarks/task-conditioned-role-replacement/
├── run-benchmark.mjs           # CLI entry: node run-benchmark.mjs [--report json]
├── fixtures/
│   └── scenarios.jsonl         # one JSON per line: { objective, requirements, expectedRole, expectedConfidence }
├── reports/                    # generated outputs (gitignored)
│   └── .gitkeep
└── README.md
```

## Running

```bash
node benchmarks/task-conditioned-role-replacement/run-benchmark.mjs           # human-readable
node benchmarks/task-conditioned-role-replacement/run-benchmark.mjs --report json > reports/run.json
```

## Exit codes

- `0` — selection accuracy ≥ configured threshold (default 0.85)
- `1` — selection accuracy below threshold; consult report

## Design notes

- The benchmark is **deterministic** and **offline**: zero network, zero
  filesystem writes outside `reports/`. CI-friendly.
- Fixtures are versioned alongside the engine in `fixtures/scenarios.jsonl`
  so regressions point at the exact input that changed behavior.
- Adding a new role to `src/cognition/task-role-engine.js` requires adding
  ≥10 fixtures spanning {empty, verify, review, rollback, monitor, docs,
  implement, plan} shapes to keep accuracy comparable.
