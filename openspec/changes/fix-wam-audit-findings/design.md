# Design: Fix Wait-a-Minute Plugin Audit Findings

## Decisions

### Requirements for Evidence and Verification
- Require non-empty evidence for BOTH "done" and "verified" statuses
- Make completion detection state/phase-based: remove the hard early-return on prompt text; keep prompt text as an additional signal, not a gate
- `confirmCompletion` must evaluate the real state (requirements, unknowns, assumptions, contract status) regardless of prompt

### Requirements for State Persistence
- Atomic writes: write to `<path>.tmp-<pid>-<rand>` then `fs.renameSync`; fsync optional
- Parse errors must throw a clear error (fail loud), never silently substitute `{}`
- Unknown per-task status must throw/surface, not be skipped

### Requirements for Migration Runner
- Migration runner must invoke each selected migration's apply/up function (support async), in ascending version order
- No backward-incompatible state schema change; keep existing file layout

### Requirements for Contract Approval
- Contract prompt only when task analysis is non-trivial; preserve once-per-task behavior

### Requirements for WAM Runtime Bypass
- Off/on bypass must be covered by tests for all three enforcement points (message-handler.js:194, index.js:913 postToolExecution, index.js:1090 tool.execute.before)
- `/wam off` bypasses chat.message, tool.execute.before, postToolExecution
- `/wam on` restores; command hook stays active