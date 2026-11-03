# Change: benchmark-real-agent-collaboration

## Why

`benchmarks/agent-orchestration/index.mjs` exercises the real orchestrator, but
its adapters are scripted inside the benchmark file. There is no entry point
that accepts a real model or adapter implementation, so the benchmark cannot
measure actual collaboration behavior, and there is no documented contract for
supplying one.

CI must stay deterministic and offline. A real adapter therefore has to be
opt-in and injectable: the default path runs with no network and no model, and
users explicitly provide their own factory through an environment variable or
the exported function.

## What Changes

1. Add `benchmarks/agent-orchestration/real-collaboration.mjs` exporting
   `runRealCollaborationBenchmark({ adapterFactory, scenarios })`.
2. Run the existing `runAgentFeedbackOrchestration` for every scenario instead
   of duplicating orchestration logic.
3. Emit a deterministic, JSON-serializable report with per-scenario metrics:
   `completed`, `accepted`, `revisions`, `replans`, `agentInvocations`,
   `handoffs`, `independentReviewArtifacts`, `estimatedTokens` and
   `expectedMet`.
4. Add a CLI entry that loads an adapter factory from
   `WAM_AGENT_BENCH_ADAPTER` and fails loud when it is missing or invalid.
5. Add the `bench:agents:real` package script and document the factory contract.
6. Add deterministic, offline tests that inject a scripted adapter.

## Impact

- Affected capability: `agent-collaboration-benchmark`.
- Affected code: `benchmarks/agent-orchestration/`, `package.json`.
- No product runtime behavior changes; the benchmark is opt-in and offline by
  default.
