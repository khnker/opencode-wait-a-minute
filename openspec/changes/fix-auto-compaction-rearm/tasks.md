# Tasks: Fix auto-compaction re-arm

## 1. Implementation
- [x] Add `sessionAutoCompactInFlight` Set next to `sessionAutoCompact`.
- [x] Replace the total-monotonicity guard with armed/disarmed hysteresis.
- [x] Send `auto: true` in the summarize body.
- [x] Clear the in-flight marker in `finally`.
- [x] Log summarize errors with `console.warn`.

## 2. Tests
- [x] Assert `auto === true` in the existing summarize test.
- [x] Add a re-arm regression test (high → low → high = two summarize calls).

## 3. Validation
- [x] `node --test --test-force-exit tests/unit/auto-compaction.test.mjs`
- [x] `npm run build`
- [x] `openspec validate --changes --strict`
