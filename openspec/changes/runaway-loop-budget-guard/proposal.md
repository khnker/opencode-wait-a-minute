# Proposal: Runaway Loop Budget Guard

## Why
There is no step or loop budget, so sessions spiral. Analysis of `opencode.db` (4,852 sessions) shows the largest sessions ran **7,462 / 6,073 / 4,423 tool calls**, and the heaviest single session consumed **477,133,907 input tokens** and 1,892,827 output tokens. Across all sessions there were **543 compaction events** and **105,213 reasoning parts** — the system relies on automatic compaction instead of detecting repetition and stopping. Agents thrash on identical tool invocations, burning tokens with no progress.

## What Changes
- Repetition tracker: detect repeated identical tool invocations using a normalized `(tool, input)` key within a session/window and count repetitions.
- Step budget: enforce a configurable per-session step budget and per-tool repetition threshold.
- At threshold, force a checkpoint (persist state) and emit a `STOP`/`ESCALATE` directive carrying the repeated key and count, instead of allowing the next identical call.
- Record no-progress evidence.
- Reset/allow a repeated key legitimately after external state changes (e.g., file digest changed).
- Deterministic; never corrupt task state on error.

## Capabilities
### New Capabilities
- `runaway-loop-budget`: repetition detection, session step budget, and checkpoint/escalate-before-compaction for runaway loops.

## Impact
- New `src/execution/loop-budget-guard.js`
- `src/execution/execution-engine.js` guard gate and `src/persistence/memory.js` (checkpoint)
- New tests `src/execution/loop-budget-guard.test.mjs`
- Target: bound runaway loops and reduce compaction/thrash on the 7k-tool-call sessions.
