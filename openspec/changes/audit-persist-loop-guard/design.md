## Context
`plugin.log` shows ~201k `AuditSuccess` + 107k `AuditPersist` entries for a single trace file (`default.json`), plus 165 identical `ENOTDIR` errors. The `.wam/tasks/` directory accumulated 2,335 task directories (clusters of 770 `false-completion-*` each). No batching, idempotency, or cap exists.

## Goals / Non-Goals
- **Goals**: Coalesce audit flushes, skip on missing/unwritable directory, cap task dirs, single summary line per batch.
- **Non-Goals**: Change the trace data schema, add persistent queue, replace `default.json` with rolling files.

## Decisions
- Coalescer lives in `src/persistence/audit.js` (new or existing). Buffer: array of entries; flush triggers: size (default 50) or idle time (default 2s). Use `fs.stat` for mtime/size checksum to detect unchanged file.
- Task-dir cap: configurable L (default 500); scan `.wam/tasks/` on each flush, evict oldest by dir mtime.
- Config via `WAM_AUDIT_BATCH_SIZE`, `WAM_AUDIT_IDLE_MS`, `WAM_TASK_DIR_MAX` env vars.

## Risks / Trade-offs
- Risk: Coalescing loses per-call trace granularity. Mitigation: each batch records entry count + first/last timestamps.
- Risk: Idle flush may never trigger in a long quiet session. Mitigation: flush on process exit hook.

## Migration Plan
1. Implement coalescer + dir gate + cap in `src/persistence/audit.js`.
2. Wire into `index.js` audit hook (replaces direct `fs.writeFile` calls).
3. Add unit tests.
4. Verify `plugin.log` no longer grows linearly with tool calls.