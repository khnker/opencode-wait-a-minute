# Tasks: Improve CQE query robustness

## Tasks List

### [T-01] Reconcile the catalog when the working tree changes
- [x] Track the last reconcile timestamp per repository in `ensureIndex`
- [x] Check `freshness()` after the TTL and reconcile dirty scopes
- [x] Keep clean repositories on the reuse path without version churn
- [x] Allow `CF_INDEX_TTL_MS` to tune the check interval

### [T-02] Degrade invalid CQP to intent parsing
- [x] Give `CqpError` a stable `name`
- [x] Validate CQP with `parseCQP` before `runCQP`
- [x] Fall back to `runIntent` only for CQP parse errors

### [T-03] Tests
- [x] Regression test for catalog freshness after a file edit
- [x] Regression test for `SELECT` / `LIST` natural-language queries
- [x] Regression test for malformed CQP and valid CQP

### [T-04] Validation
- [x] Run `node --test --test-force-exit` on affected suites
- [x] Run `openspec validate --changes --strict`
- [x] Run `npm run build`
