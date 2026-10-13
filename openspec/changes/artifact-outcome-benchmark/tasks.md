# Tasks: Artifact Outcome Benchmark

- [x] Create OpenSpec change `artifact-outcome-benchmark` (proposal, design, spec, tasks)
- [x] Implement `benchmarks/artifact-outcome/fixtures.mjs` (tagged temp-dir fixtures, escape-safe writes, guarded cleanup)
- [x] Implement `benchmarks/artifact-outcome/baseline.mjs` (baseline execution runner)
- [x] Implement `benchmarks/artifact-outcome/wam-runner.mjs` (WAM execution runner with artifact guards and sequence-numbered events)
- [x] Implement `benchmarks/artifact-outcome/verifier.mjs` (independent verifier for create-artifact and update-artifact)
- [x] Implement `benchmarks/artifact-outcome/run-benchmark.mjs` (orchestrator, deterministic report, CLI)
- [x] Add unit tests: verifier contracts, runner semantics, fixture isolation
- [x] Add integration tests: report shape, determinism, baseline/WAM agreement, cleanup accounting
- [x] Run `npm test` and verify all tests pass
- [x] Verify `node benchmarks/artifact-outcome/run-benchmark.mjs` exits 0 with all scenarios verified
