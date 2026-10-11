# Proposal: Wire Cross-Layer Coupling Tracer

## Why
We need to connect `context-query-core`'s cross-layer coupling tracer (`traceCrossLayer`) into `wait-a-minute-plugin`'s runtime path, so that tasks asking for coupling or cross-layer endpoints can automatically leverage it in a best-effort manner.

## What Changes
- Add `src/context/coupling.js` with `detectCouplingIntent` and `traceCouplingForTask`.
- Re-export both in `src/context/selection.js`.
- Wire into `src/integration/message-handler.js` to inject coupling traces if intent matches.
- Add unit tests in `tests/unit/cqe/coupling-trace.test.mjs`.
