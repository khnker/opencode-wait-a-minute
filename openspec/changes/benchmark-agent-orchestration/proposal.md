# Benchmark Agent Orchestration

## Why

The multi-agent pipeline, feedback loop and task bridge have tests, but no
comparative evidence shows what the extra invocations buy. Without a
deterministic benchmark, enabling agents is an act of faith and regressions in
review coverage or feedback boundedness are invisible.

## What Changes

- Adds an `agent-orchestration-benchmark` capability.
- Adds a deterministic benchmark harness under `benchmarks/agent-orchestration/`
  using fake adapters and no model calls.
- Compares a single-agent baseline with the bounded Analyst > Architect >
  Builder > Reviewer feedback pipeline.
- Reports invocations per role, revision and replan cycles, caught findings,
  estimated tokens and whether the injected defect is resolved.
- Adds deterministic tests and a short methodology/evidence note.

## Impact

- New benchmark module and test under `benchmarks/agent-orchestration/`.
- New capability spec: `agent-orchestration-benchmark`.
- No runtime behavior changes.
