# Integrate Agent Orchestration With The Task Loop

## Why

The multi-agent bridge can now run a bounded Analyst > Architect > Builder >
Reviewer pipeline with feedback, but the Task Loop cannot use its outcome. WAM
needs a deterministic boundary that turns a task snapshot into an agent run,
stores the bounded result under WAM ownership, and maps that result to an
existing Task Loop decision without letting agents complete tasks.

## What Changes

- Adds an `agent-task-loop` capability.
- Maps a WAM task snapshot to the orchestration input (`taskId`, `objective`,
  `acceptanceCriteria`, `artifacts`, `evidence`, `constraints`, `priorFindings`).
- Adds `runTaskAgentStep`, which runs the bounded feedback orchestration and
  optionally hands the updated task to a persistence callback.
- Adds `applyAgentRun`, which stores the latest bounded `agentRun` summary and a
  capped `agentHistory` on the task.
- Adds `decideAgentLoopAction`, exposed through `decideNextAction` as an optional
  `agent` input. An accepted review maps to `VERIFY`, never `COMPLETE`.
- Keeps `driveTaskLoop` unchanged: the host adapter opts in by passing the agent
  outcome, preserving the pure controller boundary.

## Impact

- New capability spec: `agent-task-loop`.
- New module: `src/execution/task-agent-run.js`.
- Updated controller: `src/execution/task-loop.js`.
- New tests: `tests/unit/task-agent-loop.test.mjs`.
