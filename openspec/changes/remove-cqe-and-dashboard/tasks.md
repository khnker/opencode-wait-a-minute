# Tasks: remove-cqe-and-dashboard

## Spec
- [x] Write proposal, design and capability specs for the removal.

## CQE removal
- [x] Delete `src/context/cqe-adapter.js`, `src/context/cqe-worker.mjs` and their tests.
- [x] Delete `vendor/context-query-core/`, vendor build globs, the `smoke:bun`/`bench:retrieval`/`bench:coupling` scripts and the stale CQE retrieval benchmark/docs. (`package.json` declared no `context-query-core` dependency, so no lockfile change was needed.)
- [x] Remove CQE imports and `selectContextWithCqe` / `retrieveContextWithCqe` from `src/context/context.js`.
- [x] Remove the CQE augmentation block from `src/integration/message-handler.js`; drop `phase("cqe")`, `cqeCalls`/`cqeStats` and the completion-summary line.
- [x] Rewire `index.js`: drop CQE imports/deps, strip CQE wording from the discovery nudge (native tools kept), point `/wam ctx get` at `retrieveContext`.
- [x] Remove CQE references from `src/context/context-dedupe.js`, `coupling.js`, `path-validator.js`, `selection.js` and the discovery prompts/policies.
- [x] Delete CQE tests, helpers, benchmarks and scripts (`tests/**/cqe*`, `test/message-handler.test.mjs` CQE cases, `benchmarks/cqe/`, CQE retrieval benchmarks, `scripts/cqe-bun-smoke.mjs`).
- [x] Regenerate `benchmarks/quality/prompt-eval/baselines/*.json` after the prompt text change.

## Dashboard removal
- [x] Delete the inline dashboard server block from `index.js` and the `isDashboardEnabled` import.
- [x] Delete `isDashboardEnabled` from `src/config/wam-config.js` and stop reading `WAM_DASHBOARD` / `WAM_DASHBOARD_PORT`.
- [x] Delete dashboard tests and update README/AGENTS references.

## Validate
- [x] `node --test --test-force-exit` on affected suites; full `node scripts/run-tests.mjs` (4291 tests, 0 fail).
- [x] `openspec validate --changes --strict`.
- [x] `npm run build`; `dist/` contains no vendor/CQE artifacts.
- [x] Fresh-session web verification: `npm run verify:web -- --out /tmp/wam-web-e2e-remove-cqe-and-dashboard` (11/11 PASS).
- [x] Craftsman diff audit: removed the now-dead `src/context/coupling.js` no-op path; no unjustified abstractions, flags or swallowed causes added.

## Report
- Verification: full suite 4292 tests (4289 pass, 3 skipped, 0 fail), `npm run build`, `openspec validate --strict`, fresh-session web E2E 11/11.
- Residual risk: `traceCouplingForTask` was CQE-backed and is now removed; cross-layer tracing no longer returns results (no non-CQE replacement existed).
