# Design: Agent Task Loop Integration

## Research

- Anthropic multi-agent research system: the lead agent owns iteration and
  synthesis; workers do not recursively delegate.
  https://www.anthropic.com/engineering/multi-agent-research-system
- OpenCode plugin API: session prompts are host effects, while the Task Loop is
  a deterministic controller. https://opencode.ai/docs/plugins/
- Existing WAM `autonomous-task-loop` design: the controller decides and the
  adapter performs effects; decisions are persisted before prompts.
  `openspec/changes/autonomous-task-loop/design.md`
- Existing WAM orchestration returns structured outcomes and never mutates task
  state (`src/agents/orchestrator.js`).

## Alternatives Considered

1. **Call the orchestrator directly inside `driveTaskLoop`.** Rejected: the
   loop lock is synchronous, agent invocation is asynchronous, and the host
   adapter would own task shaping, persistence and decision mapping. That would
   make the controller untestable without host mocks.
2. **Let agents own the loop and update task state.** Rejected: it violates WAM
   ownership of approvals, evidence and completion, and contradicts the role
   contract that forbids `modifyGlobalState` and `approveCompletion`.
3. **Pure bridge plus optional Task Loop input.** Chosen: `runTaskAgentStep`
   shapes input, invokes the existing bounded orchestration and returns a new
   task snapshot. `applyAgentRun` performs no IO. `decideNextAction` accepts an
   explicit `agent` outcome so the adapter decides when the result is current.

## Design

### Input mapping

`buildTaskAgentInput(task)` is deterministic and read-only:

- `taskId` comes from `task.id`, `task.taskId` or `task.task_id`.
- `objective` prefers `task.outcomeContract.objective`, then `task.objective`,
  `task.request`, `task.title` and `task.description`.
- Acceptance criteria prefer `task.outcomeContract.acceptanceCriteria`, then
  `task.acceptanceCriteria`, then `task.requirements`. Requirements are
  normalized to `{ id, description, mandatory }`; a missing list becomes one
  mandatory `task-outcome` criterion derived from the objective.
- `artifacts`, `evidence` and `constraints` are unique string arrays collected
  from explicit task fields, requirement evidence and outcome-contract fields.
  Object evidence becomes a stable reference (`ref`, `path`, `id`, `description`
  or `type`), never a serialized object.
- `priorFindings` comes from earlier agent results and retains only finding
  objects with an id, description, severity and evidence array.

### Outcome persistence

`applyAgentRun(task, outcome, { now, maxHistory })` returns a new task:

- `agentRun` stores status, verdict, stoppedAt, exhausted, cycles, results,
  handoffs and `updatedAt`.
- `agentHistory` stores at most `maxHistory` compact entries (default 5), each
  with status, verdict, stoppedAt, exhausted, cycles, result count and
  `updatedAt`.
- The input task is not mutated. Persistence is a caller-supplied callback, so
  WAM remains the only writer.

### Decision mapping

`decideAgentLoopAction(agent)` maps only terminal agent outcomes:

- `COMPLETED` + `ACCEPTED` -> `VERIFY` (`agent-review-accepted`).
- `BLOCKED` -> `WAIT_USER` (`agent-blocked`).
- `NEEDS_INPUT` -> `WAIT_USER` (`agent-needs-input`).
- `FAILED` -> `BLOCK` (`agent-failed`).
- `exhausted: true` -> `WAIT_USER`
  (`agent-revision-exhausted` or `agent-replan-exhausted`).

An accepted review never maps to `COMPLETE`; only the Completion Gate can
complete a task. `decideNextAction` applies this mapping after budget and
iteration guards, so a hard budget stop still wins.

## Risks

- Agent results can be large. Only the latest run keeps full results; history is
  capped and compact.
- A stored `agentRun` can become stale. The adapter passes `agent` explicitly
  instead of `decideNextAction` reading task state automatically.
- Orchestration errors remain `AgentOrchestrationError`; the bridge does not
  swallow them, so WAM can surface a failed run.
