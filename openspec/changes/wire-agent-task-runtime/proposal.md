# Wire Agent Orchestration Into The Task Runtime

## Why

The bridge added by `integrate-agent-task-loop` can transform a task snapshot
into a bounded multi-agent outcome, but no runtime path calls it. The Task Loop
still reaches `decideNextAction` without an `agent` input, so installing the
plugin changes nothing unless a caller invokes the bridge manually.

WAM must own this integration: agents may inform a decision, but they must not
approve completion, mutate global state, or run unbounded on every idle event.

## What Changes

- Adds an `agent-task-runtime` capability.
- Adds opt-in nested configuration: `taskLoop.agents` with `enabled` defaulting
  to `false`, plus bounded revision, replan and history limits.
- Adds environment overrides for enabling agents and tuning those limits.
- Adds a deterministic freshness guard that skips terminal agent runs and runs
  again only when no terminal result exists for the current task.
- Adds `runConfiguredTaskAgentStep`, a small adapter that applies configuration,
  invokes the existing bridge and persists through `persistTaskState`.
- Wires the idle task-loop path in `index.js` to run the agent pass before
  `driveTaskLoop`, with a per-task in-flight guard and fail-soft logging.
- Passes the resulting outcome to `driveTaskLoop` and then to
  `decideNextAction`, preserving budget and iteration precedence.

## Impact

- New capability spec: `agent-task-runtime`.
- New helper: `shouldRunTaskAgentPass` and `runConfiguredTaskAgentStep` in
  `src/execution/task-agent-run.js`.
- Updated configuration: `src/config/wam-config.js`.
- Updated runtime: `index.js` and `src/adapters/opencode-v1/session-driver.js`.
- New tests for configuration, freshness, configured execution and the
  controller handoff.
