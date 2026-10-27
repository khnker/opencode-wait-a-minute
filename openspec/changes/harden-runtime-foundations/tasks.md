# Tasks: Harden runtime foundations

- [x] 1. Add `isExplicitInstruction` to `src/policy/uncertainty.js`.
- [x] 2. Stop emitting the generic "add functionality" assumption for explicit prompts.
- [x] 3. Require `!isExplicitInstruction` before escalating the generic assumption (both copies).
- [x] 4. Skip ASKING for `[router]` dispatches in `message-handler`.
- [x] 5. Gate 1 of `synthesizeContract`: extract real requirements before the generic fallback; cap to `MAX_CONTRACT_REQUIREMENTS`.
- [x] 6. Replace `token` substring by word-boundary security keywords.
- [x] 7. Coalesce identical measurements in `recordTokenSavings` (`WAM_METRICS_DEDUPE_MS`, `occurrences`, `firstAt`, `lastAt`).
- [x] 8. Export `summarizeTokenSavings` (claimable vs raw).
- [x] 9. Regression tests: router dispatch not in ASKING, explicit plan not escalated, no security req from "tokens", coalescing window/off, summary split.
- [x] 10. `node --test --test-force-exit` on affected suites + `npm run build`.
- [x] 11. Persist per-turn skill-injection cost (`{skills, refs}`) in the context-pack evidence record and index.
- [x] 12. Retention drops synthetic records before claimable ones; summary reports the last claimable measurement even if a synthetic turn comes later.
