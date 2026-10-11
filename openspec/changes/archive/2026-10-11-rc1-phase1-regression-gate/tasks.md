# Tasks: RC1 Phase 1 — Regression & Test Gate

- [x] Task 1: Establish unified release gate script (`npm run gate`) with categorized test summary (unit, behavioral, regression, validation, benchmark)
- [x] Task 2: Isolate shared-state `.wam` across test suites to prevent leakage
- [x] Task 3: Implement regression suite for completion vocabulary (false positive / negative control)
- [x] Task 4: Implement task lifecycle matrix regression tests (invalid transitions & guarded states)
- [x] Task 5: Implement continuation matrix regression tests (same task + state changes → correct decisions)
- [x] Task 6: Implement N0-N3 admission matrix and budget invariant tests (mandatory vs optional preservation)
- [x] Task 7: Implement assumption and evidence lifecycle regression tests (preventing unverified completion)
- [x] Task 8: Implement persistence and recovery corruption tests (`.wam/tasks` robustness)
- [x] Task 9: Validate entire suite and run `openspec validate --all --strict`
