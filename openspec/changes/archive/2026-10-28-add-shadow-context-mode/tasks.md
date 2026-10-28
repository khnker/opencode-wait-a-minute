## 1. Implementation

- [x] 1.1 Add `src/context/context-shadow.js` with `resolveProjectionMode`,
      `buildShadowRecord` and `appendShadowRecord`.
- [x] 1.2 Add `projectionMode` to `buildContextBrief` and expose `budgetChars` /
      `projection` on its result.
- [x] 1.3 Add `contextProjection` (env `WAM_CONTEXT_PROJECTION`) to the config resolver.
- [x] 1.4 Wire the compaction hook: resolve mode, inject legacy in `legacy`/`shadow`,
      append telemetry in `shadow`, fail-soft.

## 2. Tests

- [x] 2.1 Unit: default/selection/invalid fallback, deterministic record with fixed
      clock, both hashes, bounded append honoring `WAM_METRICS_DIR`, fail-soft write.
- [x] 2.2 Integration: shadow output byte-identical to legacy + record appended;
      unset equals explicit active with no shadow file; unwritable metrics dir does not
      break compaction.

## 3. Validation

- [x] 3.1 `node --test --test-force-exit` on touched tests plus
      `tests/integration/semantic-pipeline.test.mjs` and
      `tests/unit/context-curation-integration.test.mjs`.
- [x] 3.2 `openspec validate --changes --strict`.
- [x] 3.3 `npm run build`.

## 4. Activation

- [x] 4.1 Add `scripts/context-shadow-report.mjs` + `npm run context:shadow-report`
      (read-only, exit 0/1/2), with unit tests, and document the
      legacy → shadow → active policy plus `contextProjection: "legacy"` rollback in
      `design.md`.
