# Tasks: WAM CQE Runtime Integration (CHANGE 03)

## Recon
- [x] Confirm adapter `src/context/cqe-adapter.js` imports `createEngine` from `context-query-core`
- [x] Confirm `package.json` has `"context-query-core": "file:../context-query-core"`
- [x] Detect broken in-flight change: `selectContext` async with 5 failing tests

## Fix (avoid async cascade)
- [x] Revert `selectContext` to synchronous (no CQE block inside)
- [x] Add `selectContextWithCqe(task, opts)` async, best-effort CQE augmentation
- [x] Re-export `selectContextWithCqe` from `src/context/selection.js`
- [x] Update `tests/unit/cqe/select-context-cqe.test.mjs` to target the async variant

## Verification
- [x] Targeted suites pass (context, refactor-context-engine, cqe, context-assembly, multilayer-skill-injection)
- [x] Full suite `npm test` → 2856 pass / 0 fail
- [x] OpenSpec change validates

## Deferred
- [ ] Wire `selectContextWithCqe` into the async runtime path (`message-handler.js`)
- [ ] Commit (awaiting explicit approval)

## Owner decisions pending
- [ ] Whether runtime wiring is required for CHANGE 03 sign-off or accepted as adapter + entrypoint
