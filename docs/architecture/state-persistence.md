# State Persistence

WAM persists task state so verified progress survives across model interactions
and process restarts.

## What persists

- current task state and lifecycle;
- verified knowledge and evidence;
- context capsules and session identity;
- append-only task runs.

## Layout

```text
.wam/
├── session.json                  # session identity (root + sessionID scoped)
├── task-state.json               # runtime task state
├── tasks/<taskId>/task.json      # per-task state
├── capsules/<id>.json            # context capsules (L1–L4)
└── traces/selection-log.jsonl    # context selection trace
```

The `StateStore` (`src/state/state-store.js`) additionally uses a sealed,
crash-safe layout under its own root:

```text
<root>/state/<type>/<id>.json      # sealed state documents
<root>/journal.log                 # append-only transaction log
<root>/state-index.json            # lightweight index
<root>/quarantine/<type>/<id>.json # files that failed validation
<root>/snapshots/<ts>.json         # periodic snapshots (for GC)
```

## Durability mechanism

- **Atomic write** — `atomicWrite` (`src/state/state-store.js:32`) writes to a
  temp file in the same directory, then `rename`s over the destination. A crash
  mid-write leaves either the old target intact or the fully written new target;
  never a torn file.
- **Journal / replay** — state mutations append to `journal.log`
  (`TransactionLog`), and `replay` reconstructs pending state after a crash.
- **Schema seal / quarantine** — sealed documents are validated; files that fail
  validation move to `quarantine/` rather than being silently loaded.

## Task runs

Task runs are append-only records. `addObservation`, `addDecision` and
`addEvidence` push a new item with a monotonic id and timestamp; they never
mutate prior items. A missing run file throws (`Run <id> not found`) instead of
silently creating one. Recovery reads the latest run and must not fabricate
state.

## Isolation

`.wam/` is runtime-only. It is listed in `.gitignore` (`.wam/`), never tracked by
git, and excluded from the published package (`package.json` `files` does not
include it). See [Task Isolation](../claims/task-isolation.md).

## Tests

- `src/state/persistence-restart.test.mjs`
- `src/state/replay-engine.test.mjs`
- `tests/runtime-state-isolation.test.mjs`
- `tests/unit/transaction-log.test.mjs`
- `tests/unit/verification-persistence.test.mjs`

## Related documentation

- [Task Lifecycle](task-lifecycle.md)
- [Invariants](invariants.md)
- [Task State](../claims/task-state.md)
