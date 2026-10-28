# Tasks: harden-shadow-gate

## 1. Producer

- [x] 1.1 `buildContextBrief` returns `fallbackReason` when projection is `null`
- [x] 1.2 `buildShadowRecord` emits `projectionAvailable` and `fallbackReason`
- [x] 1.3 `index.js` forwards the brief fallback reason into the record

## 2. Gate

- [x] 2.1 Count available/fallback/unknown records
- [x] 2.2 Apply `--min-records` only to `projectionAvailable === true`
- [x] 2.3 Print availability summary and keep exit codes 0/1/2

## 3. Tests

- [x] 3.1 Unit: available vs fallback record fields
- [x] 3.2 Report: available/fallback/unknown counting and shortfall detail
- [x] 3.3 Integration: no ledger/base writes `false` with reason; seeded ledger writes `true`

## 4. Validation

- [x] 4.1 Focused `node --test` runs pass
- [x] 4.2 `openspec validate --changes --strict` and `--specs --strict`
- [x] 4.3 `npm run build` and shadow harness pass
