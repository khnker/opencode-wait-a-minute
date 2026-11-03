# Tasks

- [x] 1. Add `benchmarks/agent-orchestration/real-collaboration.mjs` with `runRealCollaborationBenchmark`, required `adapterFactory`, and default scenarios
- [x] 2. Reuse `runAgentFeedbackOrchestration` and emit per-scenario metrics/`expectedMet`
- [x] 3. Add the `WAM_AGENT_BENCH_ADAPTER` CLI entry with loud failure on missing/invalid factory
- [x] 4. Add the `bench:agents:real` package script
- [x] 5. Document the env var and factory contract in the benchmark README
- [x] 6. Add deterministic, offline tests for rejection, both scenarios, metrics, request validation and the CLI import guard
- [x] 7. Run the affected tests and `npm run build`
