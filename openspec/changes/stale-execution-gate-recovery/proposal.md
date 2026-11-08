# Stale execution-gate recovery - Proposal

## Problem Statement

The execution gate is an in-memory guard: an agent pass writes
`executionGate.active=true` while it runs and clears it in `finally`. If the
process dies or restarts mid-pass, the persisted gate stays `active=true` but
the new process has no pass in flight to clear it. On the next mutating tool
call WAM reads the persisted gate and blocks every edit forever, even after the
user restarts OpenCode.

## Proposed Solution

Tag every gate with the owning process (`ownerPid`) and treat a persisted gate
whose owner is not the current process as stale. Before enforcing the gate in
`tool.execute.before`, clear stale gates and continue. Legacy gates without
`ownerPid` are also stale because no in-memory pass can own them.

## Acceptance Criteria

- [x] A gate written with `ownerPid` different from `process.pid` is cleared on the next mutating tool call.
- [x] A legacy gate without `ownerPid` is cleared instead of blocking forever.
- [x] A gate owned by the current process still blocks mutations while its agent pass is in flight.
- [x] Regression tests cover stale-gate recovery, legacy gates, and the existing in-process block.

## Implementation Plan

See `tasks.md`.

## Dependencies

- `wire-agent-task-runtime` (execution gate and agent pass lifecycle)

## Last Updated

2026-11-05
