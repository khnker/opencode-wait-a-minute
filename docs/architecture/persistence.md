# Persistence

WAM persists task state so verified progress survives across model interactions
and process restarts. The detailed mechanism lives in
[State Persistence](state-persistence.md).

## What persists

- **Task state** — current lifecycle and verified knowledge, under `.wam/`.
- **Evidence** — observations, decisions and evidence in append-only task runs.
- **Context capsules** — task-relevant knowledge under `.wam/capsules/`.
- **Session identity** — scoped to `(root, OpenCode sessionID)`.

## What does not persist

- **Full repository context** — reconstructed per task, not accumulated.
- **Intermediate builds** — not retained between verification attempts.
- **Raw conversation** — only derived task state persists.

## Storage mechanism

- Durable, atomic file writes (temp file + rename) under `.wam/` and the
  `StateStore` root; see [State Persistence](state-persistence.md).
- Append-only transaction journal with replay for crash recovery.
- No in-memory-only state: `.wam/` is the source of truth at rest, and it is
  runtime-only (untracked, never published).

## Related documentation

- [State Persistence](state-persistence.md)
- [Architecture Overview](overview.md)
- [Task State](../claims/task-state.md)
- [Runtime](runtime.md)
