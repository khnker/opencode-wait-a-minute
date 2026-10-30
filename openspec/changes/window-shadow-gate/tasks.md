## 1. Gate windowing

- [x] 1.1 Add `evaluatedEntries(parsed, windowSize)` selecting the last N
      records with `projectionAvailable === true`.
- [x] 1.2 Apply `mode`, `budget`, `delta`, `selection` and aggregates to the
      window; keep `parse` over the whole file.
- [x] 1.3 Count the `records` gate over the window and report
      `records: <total> (evaluated <n>)`.

## 2. CLI

- [x] 2.1 Add `--window <n>` (default: `--min-records`) and reject values < 1.
- [x] 2.2 Update usage text.

## 3. Validation

- [x] 3.1 Tests: historical delta breach outside the window passes; breach
      inside the window fails; `--window` honored by the CLI.
- [x] 3.2 Existing report tests still pass (17/17).
- [x] 3.3 Real-data check: with 7 available records the 5 pre-fix records are
      still inside the default window, so `delta` still fails (and `records`
      fails too); `--window 2` shows the two post-fix records pass. The old
      records fall out once 20 newer available records exist.
- [x] 3.4 `openspec validate window-shadow-gate --strict`.
