## 1. Writer

- [x] 1.1 Add `src/state/ledger-writer.js` with `seedRequirements`,
      `recordRequirementStatus`, `resetExecutionLedger`.
- [x] 1.2 Unit tests: seed idempotency, status chains, lazy seed, illegal
      transition stop, reset.

## 2. Wiring

- [x] 2.1 Seed the ledger on `approveContract`.
- [x] 2.2 Record status in `markRequirement`.
- [x] 2.3 Reset the ledger on contract edit.
- [x] 2.4 Integration test: writer → `buildContextBrief` yields a projection
      (`fallbackReason: null`).

## 3. Validation

- [x] 3.1 `node --test --test-force-exit` on affected suites.
- [x] 3.2 `openspec validate add-execution-ledger-writer --strict`.
- [x] 3.3 `npm run build`.
