# Tasks

## 1. CI unification

- [x] 1.1 Point `ci.yml` `test` job at `npm run gate` with `WAM_SKIP_OPENCODE_E2E=1`
- [x] 1.2 Remove the redundant `production-validation` job from `ci.yml`
- [x] 1.3 Point `release.yml` at `npm run gate` with `WAM_SKIP_OPENCODE_E2E=1`

## 2. OpenCode E2E hardening

- [x] 2.1 Replace the self-answering prompt with an arithmetic prompt whose answer is absent from the prompt
- [x] 2.2 Require the expected answer in the output; fail when absent
- [x] 2.3 Consolidate the duplicated `stdout` listeners
- [x] 2.4 Preserve graceful skip paths (`WAM_SKIP_OPENCODE_E2E=1`, missing binary)

## 3. Legacy gate retirement

- [x] 3.1 Confirm the legacy suites are covered by the recursive `npm test` runner
- [x] 3.2 Delete `scripts/production-gate.mjs`
- [x] 3.3 Verify no workflow/package/source references remain

## 4. Verification

- [x] 4.1 `WAM_SKIP_OPENCODE_E2E=1 node tests/e2e/opencode/smoke.mjs` exits 0
- [x] 4.2 `node tests/e2e/opencode/smoke.mjs` prints `round-trip verified` and exits 0
- [x] 4.3 `npm run gate` reports all required stages PASS
- [x] 4.4 `openspec validate unify-ci-on-release-gate --strict` passes
- [x] 4.5 Update `CHANGELOG.md`
- [ ] 4.6 Commit
