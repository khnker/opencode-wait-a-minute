# Tasks: Harden token-savings evidence

- [x] 1. Add `charsPerToken` option + `estimator` provenance to `estimateTokens`/records.
- [x] 2. Require a measured baseline to compute `savingsPct`/`savingsTokens`.
- [x] 3. Keep raw `deltaTokens` (may be negative).
- [x] 4. Stop passing assembled lines as `historyTokens` in `assembly.js`.
- [x] 5. Rotate `token-savings.json` to `maxRecords` with atomic writes + soft archive.
- [x] 6. Update `printTokenSavingsSummary` to say "not claimed" when unmeasured.
- [x] 7. Update `token-savings-meter.test.mjs` / `token-savings-summary.test.mjs`.
- [x] 8. Redirect test metrics writes via `WAM_METRICS_DIR` in `scripts/run-tests.mjs`.
- [x] 9. Capture provider usage via the `event` hook (bounded, per session).
- [x] 10. Require measured baseline + provider usage for any savings claim.
- [x] 11. Only emit `[wam design budget]` when design content is actually injected.
- [x] 12. Run `node --test --test-force-exit` on the affected suites and `npm run build`.
