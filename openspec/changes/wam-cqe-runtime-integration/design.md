# Design: WAM CQE Runtime Integration (CHANGE 03)

## Architecture

```
message-handler (async) ──┐
                          │  (follow-up: call async variant)
assembleContext (sync) ───┤
                          ▼
                   selectContext (sync)            ← unchanged contract
                          │
        selectContextWithCqe (async)               ← new entrypoint
                          │
                  detectFileSearchIntent(task)
                          │  yes
                          ▼
              retrieveWithCqe(task, { repoRoot })    src/context/cqe-adapter.js
                          │
                  context-query-core.createEngine
                          │
              pkg.file_context = items              ← best-effort augmentation
              pkg.rationale += "CQE: ..."
```

## Implementation

### `src/context/context.js`

- `selectContext` reverted to `export function` (synchronous); the CQE block was
  removed from it. All existing callers keep working with no `await`.
- New:

  ```js
  export async function selectContextWithCqe(task, opts = {}) {
    const pkg = selectContext(task, opts);
    if (!opts.disableCqe && detectFileSearchIntent(task)) {
      try {
        const cqeRes = await retrieveWithCqe(task, { repoRoot: opts.root || process.cwd() });
        if (cqeRes && cqeRes.items && cqeRes.items.length > 0) {
          pkg.file_context = cqeRes.items;
          pkg.rationale.push(`CQE: retrieved ${cqeRes.items.length} file matches`);
        }
      } catch { /* best-effort; native context prevails */ }
    }
    return pkg;
  }
  ```

### `src/context/selection.js`

Re-export `selectContextWithCqe` alongside `selectContext` / `retrieveContext`.

### `src/context/cqe-adapter.js` (already committed)

- `retrieveWithCqe(queryText, constraints)` returns `{ items, provenance, ... }`.
- Modes: `disabled` | `shadow` | `enabled` (default), via `WAM_CQE_MODE`.
- Explicit `repoRoot`; never relies on an accidental `process.cwd()`.
- CQE success never transitions task state; empty vs error distinguishable.

## Verification

- Targeted: `node --test tests/unit/{context,refactor-context-engine}.test.mjs
  tests/unit/cqe/select-context-cqe.test.mjs tests/unit/{context-assembly,multilayer-skill-injection}.test.mjs` → pass.
- Full suite: `npm test` → 2856 pass / 0 fail.

## Decisions

- Do **not** make `selectContext` async. The sync/async split keeps the
  `assembleContext` contract stable and avoids a ~13-caller cascade.
- CQE is augmentation, not authority: it never gates sufficiency or task state.
- File-search intent detection is a closed regex set
  (`find|search|grep|locate|where is`), deterministic and cheap.
