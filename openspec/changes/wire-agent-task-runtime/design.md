# Design: Wire Agent Orchestration Into The Task Runtime

## Research

- OpenCode plugin API: `session.idle` and `session.prompt` are host effects, so
  the plugin must keep orchestration outside the pure Task Loop controller.
  https://opencode.ai/docs/plugins/
- Anthropic multi-agent research system: a lead process owns iteration and
  synthesis; workers do not recursively delegate or approve completion.
  https://www.anthropic.com/engineering/multi-agent-research-system
- Existing WAM Task Loop design: `driveTaskLoop` is synchronous, persists loop
  state before prompting and treats the controller as the single decision
  authority (`src/adapters/opencode-v1/session-driver.js`).
- Existing WAM persistence model: the per-task `task.json` is the source of
  truth and `persistTaskState` is the single writer for it
  (`src/skills/engine.js`, `src/state/task-state-file.js`).

## Alternatives

### 1. Await the agent pass inside `withLoopLock`

Rejected. `withLoopLock` is synchronous: it releases the lock as soon as its
callback returns, so an `async` callback would release the lock while the agent
is still running. Changing the lock to async would touch every Task Loop caller
and widen the change beyond this capability.

### 2. Introduce a new async loop lock

Rejected for now. It would make correctness depend on a second lock protocol
while the existing controller is intentionally synchronous. Serializing the
agent pass per task with a small in-flight set is sufficient for one host event
loop.

### 3. Run the agent pass before `driveTaskLoop` in `maybeTaskLoop`

Chosen. The agent pass is a bounded host effect that produces an input for the
pure controller. `driveTaskLoop` can keep its synchronous lock and simply
receive the outcome. This also lets persistence happen once, before the
controller reads the task.

### 4. Re-run agents on every idle event

Rejected. It would multiply cost and could loop after a terminal result.
Instead, `shouldRunTaskAgentPass` skips `COMPLETED+ACCEPTED`, exhausted,
`BLOCKED`, `NEEDS_INPUT` and `FAILED` outcomes. Runs with no terminal result are
retried on the next idle event.

### 5. Persist only in the aggregated `.wam/task-state.json`

Rejected. The per-task file is the source of truth and the Task Loop reads it.
The runtime persists with `persistTaskState`; existing reconciliation keeps the
aggregated view consistent.

## Decisions

- Configuration is nested under `taskLoop.agents`, default `enabled: false`, so
  existing installs do not start spending on agent invocations.
- Limits: `maxRevisionCycles` and `maxReplanCycles` default to `2` and `1`;
  `maxHistory` defaults to `5`. Zero is accepted for the cycle limits.
- `shouldRunTaskAgentPass` is pure and deterministic:
  - no `agentRun` -> run;
  - `COMPLETED` with `ACCEPTED` -> skip;
  - `exhausted` -> skip;
  - `BLOCKED`, `NEEDS_INPUT`, `FAILED` -> skip;
  - any other outcome -> run.
- `runConfiguredTaskAgentStep` returns `null` when disabled or skipped, and the
  bridge result otherwise.
- `index.js` keeps a per-task in-flight set; a second idle event cannot start a
  concurrent agent run for the same task.
- Agent failures are logged and the Task Loop still runs without an `agent`
  input, preserving deterministic fallback behavior.
- The agent outcome is persisted before `driveTaskLoop` runs. Accepted reviews
  map to `VERIFY`; they never map to `COMPLETE`.

## Risks

- Agent passes are long-running; the in-flight guard is per process, not
  cross-process. A future multi-process host would need a durable lease.
- Persisting the updated task before the controller runs changes what the
  controller loads; tests must assert the controller still owns the decision.
- Enabling agents can increase token usage substantially; the default stays off
  and the feature must remain opt-in.

## Impact

- `src/execution/task-agent-run.js`: freshness and configured runner.
- `src/config/wam-config.js`: nested parsing and defaults.
- `index.js`: async idle path, adapter construction, persistence, in-flight set.
- `src/adapters/opencode-v1/session-driver.js`: optional `agent` handoff.
- `tests/unit/task-agent-loop.test.mjs`, `tests/unit/wam-config.test.mjs`,
  `src/adapters/opencode-v1/session-driver.test.mjs`.
