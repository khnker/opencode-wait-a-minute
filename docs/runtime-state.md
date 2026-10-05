# Runtime State (`.wam/`)

`.wam/` is **runtime / user state**, not repository content. It is created by WAM
at execution time and may be written on every run.

## Versioned vs ignored

| Path | Class | Notes |
|------|-------|-------|
| `.wam/` (entire tree) | **Ignored** | Covered by `/.wam/` in `.gitignore`. |
| `.wam/task-state.json` | Runtime | Task queue state; recreated on use. |
| `.wam/session.json` | Runtime | Active session pointer. |
| `.wam/context/**` | Runtime | Session logs, project memo, recent changes. |
| `.wam/snapshots/**` | Runtime | Context/continuation snapshots. |
| `.wam/skills/**` | Runtime | Runtime skill registry/cache. |

No file under `.wam/` is tracked or published. The published package surface
(`package.json#files`) does not include `.wam/`.

## Lifecycle

1. WAM resolves its root (default `<cwd>/.wam`, override via `WAM_ROOT`).
2. Runtime state is read/written there.
3. Nothing from `.wam/` is committed or packed.
4. Deleting `.wam/` resets runtime state without affecting the repository.

## Invariant

`git ls-files .wam` MUST be empty and `npm pack` MUST NOT contain `.wam/`.
This is enforced by `tests/runtime-state-isolation.test.mjs`.
