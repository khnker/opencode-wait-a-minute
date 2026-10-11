## Why
The WAM audit path writes the same `default.json` trace file on every tool call. `plugin.log` shows ~502k `AuditPersist`/`AuditSuccess` entries for a single trace, producing an 84 MB log and 2.3k task directories. No flush cap or directory-state gate exists, so the plugin accumulates runaway writes instead of coalescing.

## What Changes
1. Add a flush coalescer in the audit persistence path that batches entries and flushes on a bounded interval or entry threshold.
2. Gate trace flushes on `.wam/` directory state: skip or merge when the directory is missing, unwritable, or the trace file is unchanged.
3. Emit a single summary line per batch instead of one line per entry.
4. Cap the number of live task directories retained under `.wam/tasks/`.

## Capabilities
**New Capabilities**: `audit-persist-loop-guard`

## Impact
Reduces `plugin.log` churn, prevents `.wam/tasks/` explosion, and preserves traceability without unbounded disk writes.