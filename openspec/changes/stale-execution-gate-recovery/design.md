# Stale execution-gate recovery - Design

## Context

`executionGate` is persisted in the task state (`task.json`) so that
`tool.execute.before` can block main-session mutations while WAM's delegated
agents evaluate or implement the task. Only one process can be running an agent
pass, and the pass is tracked in memory (`agentRunInFlight`). The persisted
gate has no owner, so a restart loses the in-memory pass but keeps the lock.

## Research

- Node.js `process.pid`: the current process identifier is stable for the
  lifetime of the process and changes after a restart.
  https://nodejs.org/api/process.html#processpid
- `proc(5)` / `kill(2)`: PIDs are process-scoped identities; relying on a
  persisted PID owned by another process is the standard way to detect a lock
  left by a dead process.
  https://man7.org/linux/man-pages/man5/proc.5.html
- Fencing tokens / lease ownership: distributed-system pattern for rejecting
  work from a previous owner using an owner generation.
  https://martinfowler.com/articles/patterns-of-distributed-systems/fencing-token.html

## Alternatives

1. **Clear every active gate at plugin startup (chosen shape, rejected detail).**
   Safe at startup, but the plugin also handles tool calls after reloads and
   multiple `.wam` roots; a blind startup sweep would need to discover and
   rewrite every task. Owner-PID detection is local to the gate check and works
   for any root.
2. **Use only `agentRunInFlight` (no persisted marker).**
   Correct inside one process, but after a restart the set is empty for every
   task, so WAM cannot distinguish "no pass" from "stale gate" without reading
   the persisted gate. It also cannot be unit-tested without simulating a real
   pass.
3. **Time-based lease timeout.**
   Would unblock hung passes, but also lets the main model write while a long
   agent pass is legitimately running, creating conflicting edits. Rejected.
4. **Chosen: owner PID on the persisted gate.**
   `runTaskAgentPass` writes `ownerPid: process.pid`. `isExecutionGateStale`
   compares it with the current `process.pid`; missing owners (legacy gates)
   are stale. The check runs before enforcement in `tool.execute.before`, so a
   restart self-heals on the first mutating action without a startup scan.

## Behavior

- Gate owner is the current process and a pass is in flight: block (unchanged).
- Gate owner is another process: clear `active`, persist `completedAt`, allow.
- Gate has no `ownerPid` (created before this change): clear and allow.
- Read-only tools are unaffected.

## Risks

- PID reuse could make an old gate look current. The window is small and the
  next pass rewrites the gate; a generation token can be added later if needed.
- Clearing a stale gate allows the user to edit while no WAM pass runs, which is
  the intended recovery behavior.
