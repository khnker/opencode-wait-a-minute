# Tasks: Improve CQE failure diagnostics and outcome accounting

## Tasks List

### [T-01] Add failure classifier to the CQE adapter
- [x] Export `classifyCqeFailure(err, opts)` with stable codes
- [x] Export `CQE_FAILURE_HINTS`
- [x] Add `failureCode` to adapter metadata for success, empty, error and shadow paths

### [T-02] Propagate diagnostics through context selection
- [x] Add `failureCode`, `failureHint` and `empty` to `cqeMeta` in `selectContextWithCqe`
- [x] Classify exceptions instead of the generic `exception` reason

### [T-03] Make the injected prompt line actionable
- [x] Distinguish empty results from failures in `message-handler.js`
- [x] Include failure code and hint when CQE failed

### [T-04] Persist bounded outcome counters
- [x] Increment `cqeStats` alongside `cqeCalls`
- [x] Keep the structure bounded (fixed keys only)

### [T-05] Tests and validation
- [x] Unit tests for `classifyCqeFailure`
- [x] Integration test for `cqeMeta.failureCode` propagation
- [x] Run `node --test --test-force-exit` on affected suites
- [x] Run `openspec validate --changes --strict` and `npm run build`
