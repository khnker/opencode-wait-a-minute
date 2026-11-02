# Tasks

- [x] Add nested `taskLoop.agents` defaults and env/file parsing.
- [x] Add `shouldRunTaskAgentPass` and `runConfiguredTaskAgentStep`.
- [x] Pass the agent outcome through `driveTaskLoop` to `decideNextAction`.
- [x] Wire the idle task-loop path with adapter creation, persistence and an
      in-flight guard.
- [x] Add tests for configuration, freshness, configured execution and the
      controller handoff.
- [x] Run affected tests, `openspec validate --changes --strict`, build and
      load-check.
