# Tasks — Fix Release Gate Failures
## 1. Version parity
- [x] 1.1 Set `package.json#version` to `1.1.0`
- [x] 1.2 Align `package-lock.json` version fields to `1.1.0`
- [x] 1.3 `node scripts/verify-version-parity.mjs` exits 0
## 2. Scoped fail-closed risk classification
- [x] 2.1 Restore scoped fail-closed in `src/policy/action-capabilities.js` (governed UNKNOWN → BLOCKED)
- [x] 2.2 Re-export `OUT_OF_SCOPE_TOOLS` (meta/runtime allowlist: `compress`, `delegate_task`, `call_agent`, `todowrite`/`todo_write`)
- [x] 2.3 Meta tools resolve SAFE and are never blocked
- [x] 2.4 `node --test tests/unit/action-capabilities-mcp.test.mjs tests/unit/risk-engine.test.mjs tests/unit/risk-engine.failclosed.test.mjs` passes
## 3. Published surface hygiene
- [x] 3.1 Fix `package.json` `files`: exclude `prompts/fixtures/**`, `**/*.test.{js,mjs}`, `**/bench-*.mjs`, `**/node_modules/**`; keep vendor runtime
- [x] 3.2 `npm pack --dry-run --json` lists no fixture/test/bench/node_modules paths
- [x] 3.3 `tests/unit/package-surface.test.mjs` passes
- [x] 3.4 `node scripts/verify-security.mjs` passes
## 4. Continuation live delta emission
- [x] 4.1 Emit N2 live delta from an APPROVED contract even when no persisted live context file exists
- [x] 4.2 Do not re-emit N1/N3/PROPOSED; DONE hard-block still active
- [x] 4.3 `node --test tests/unit/plugin-load.test.mjs` passes
## 5. Performance sanity
- [x] 5.1 Bind the 6th destructured module (`engine`) in `buildPhases`
- [x] 5.2 `node scripts/performance-sanity.mjs` completes without error
## 6. Test scope
- [x] 6.1 Add `vendor` to the `scripts/run-tests.mjs` ignore set
- [x] 6.2 `npm test` no longer runs vendor tests
## 7. Gate + closure
- [x] 7.1 `npm run gate` exits 0 — ALL gates PASS (incl. OpenCode Smoke E2E `loaded:true`)
- [x] 7.2 `openspec validate fix-release-gate-failures` passes
- [x] 7.3 Commit the change
- [ ] 7.4 Archive the change (after commit)
## 8. Bun runtime compatibility — lazy vendor import
- [x] 8.1 Remove static `import` of `vendor/context-query-core` from `src/context/cqe-adapter.js`
- [x] 8.2 Remove static `import` of `vendor/context-query-core` from `src/context/coupling.js`
- [x] 8.3 Both use `await import(...)` with try/catch; CQE degrades to native retrieval when `node:sqlite` unavailable
- [x] 8.4 `createCqeEngine` made async; integration tests updated to await
- [x] 8.5 Bun repro (`/tmp/opencode/dbg/proj`) prints `ok`
- [x] 8.6 `node tests/e2e/opencode/smoke.mjs` passes with `loaded:true`
- [x] 8.7 `npm test` passes (no vendor tests run)
- [x] 8.8 `node scripts/verify-security.mjs` passes
- [x] 8.9 `npm run gate` exits 0 — ALL gates PASS
