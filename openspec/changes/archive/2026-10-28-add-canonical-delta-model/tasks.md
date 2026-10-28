# Tasks: Canonical delta model

## 1. Change artifacts

- [x] 1.1 Write `proposal.md`, `design.md` (research, alternatives, chosen design).
- [x] 1.2 Add the `canonical-delta-model` spec delta.

## 2. Persistence

- [x] 2.1 Add `canonicalDir`, `basePath`, `proposalsPath` under `.wam` via
      `wamStateDir`.
- [x] 2.2 Reuse `atomicWrite` from `src/state/state-store.js` for both files.
- [x] 2.3 Seed base version `0` from the CPC when `base.json` is absent.
- [x] 2.4 Keep only `previousVersion` as lineage; no snapshot archive.

## 3. Delta lifecycle

- [x] 3.1 Implement `proposeDelta` without mutating the base.
- [x] 3.2 Implement `validateDelta` (never throws): baseVersion, op enum, target
      existence/active, entry kind, session contamination.
- [x] 3.3 Implement `acceptDelta` with a fresh base read and all-or-nothing write.
- [x] 3.4 Implement `rejectDelta`, `listDeltas`, `materializeBase`.
- [x] 3.5 Keep invalidated entries with `invalidatedBy`/`invalidatedAt`.

## 4. Verification

- [x] 4.1 Add `src/context/canonical-deltas.test.mjs` covering propose/reject/
      accept, stale baseVersion, invalid ops, restart, invalidation history and
      idempotent accept.
- [x] 4.2 Run `node --test --test-force-exit src/context/canonical-deltas.test.mjs`.
- [x] 4.3 Run the existing CPC and memory test suites.
- [x] 4.4 Run `openspec validate --changes --strict` and `npm run build`.
