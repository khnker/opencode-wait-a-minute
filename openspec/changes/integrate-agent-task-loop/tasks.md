# Tasks

- [x] Map task state to orchestration input deterministically.
- [x] Add `runTaskAgentStep` with optional persistence callback.
- [x] Store bounded `agentRun` and `agentHistory` without mutating the input task.
- [x] Map agent outcomes to Task Loop decisions and wire the optional `agent` input.
- [x] Add tests for mapping, persistence, decision mapping and stale-safe controller input.
- [x] Run tests, `openspec validate --changes --strict`, build and load-check.
