## 1. Projection

- [x] 1.1 Add `src/context/semantic-projection.js` with `buildSemanticProjection`.
- [x] 1.2 Add `renderSemanticProjection` with section headings and `maxChars` cap.
- [x] 1.3 Filter decisions to live statuses and keep evidence as refs only.

## 2. Brief integration

- [x] 2.1 Accept optional `root`, `ledger`, `base`, `constraints` in `buildContextBrief`.
- [x] 2.2 Emit projection sections only when a ledger/base exists; otherwise legacy output.
- [x] 2.3 Avoid duplicated constraints/decisions blocks and fail soft on projection errors.
- [x] 2.4 Pass `root` from the compaction hook inside the existing try/catch.

## 3. Tests

- [x] 3.1 Add `src/context/semantic-projection.test.mjs`.
- [x] 3.2 Add `src/context/context-brief.test.mjs`.
- [x] 3.3 Run `tests/unit/context-curation-integration.test.mjs` for the hook contract.
- [x] 3.4 Add large-ledger regression: priority selection keeps critical requirements under the cap.

## 4. Validation

- [x] 4.1 `node --test --test-force-exit` on the three affected files.
- [x] 4.2 `openspec validate --changes --strict`.
- [x] 4.3 `npm run build`.
