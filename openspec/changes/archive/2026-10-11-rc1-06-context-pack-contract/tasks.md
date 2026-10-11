# Tasks

## Implementation
- [x] Context pack assembly module: `src/context-assembly-contract.js`, `src/context-builder.js`, `src/context-pack-authority.js`.
- [x] Tier rules (N0/N1/N2/N3) exercised: `tests/unit/context-assembly.test.mjs`, `tests/unit/context-assembly-contract.test.mjs`.
- [x] Deterministic + deduplicated output: `tests/unit/context-tests.test.mjs` (`09_duplicate_context_removed`), `tests/unit/context-snapshot.test.mjs`.
- [x] Reproducible: same input assembles to identical packs.

## Validation
- [x] `node --test tests/unit/context-assembly.test.mjs tests/unit/context-assembly-contract.test.mjs` passes.
- [x] `openspec validate rc1-06-context-pack-contract --strict` passes.
