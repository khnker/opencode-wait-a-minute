# Verification: explicit contract approval

## Unit tests

```bash
node --test --test-force-exit \
  tests/unit/build-persisted-state-phase.test.mjs \
  tests/unit/root-identity-bootstrap.test.mjs
```

Result: 11 tests, 11 pass, 0 fail.

Covered regressions:

- A new non-trivial contract in the default/advisory config is persisted as
  `contract.status: "PROPOSED"` with no approval prompt and no blocking.
- An existing `APPROVED` contract is preserved across a later message
  (`status: "APPROVED"`, `phase: "IMPLEMENTING"`).
- `/wam contract approve` (`plugin.approveContract`) still transitions
  `PROPOSED → APPROVED` and `phase → IMPLEMENTING`.

## OpenSpec

```bash
npx openspec validate --changes --strict
```

Result: `171 passed, 0 failed (171 items)`; the change validates as
`✓ change/approve-contract-explicit`.

## Build

```bash
npm run build
```

Result: `Build completed successfully.`

## Fresh-session web verification

```bash
npm run verify:web -- --out /tmp/wam-web-e2e-contract-explicit
```

- Run: `2026-11-09T20-19-21-459Z-bc46130c`
- Result: **PASS**, 11/11 checks, 142499 ms.
- Session: `ses_e3e08d026ffeJ7xPflCeY7wVEr` (fresh `opencode web`, isolated fixture).
- Report: `/tmp/wam-web-e2e-contract-explicit/report.md`.
- Check `contract-approved`: `contract.status=PROPOSED approval=advisory`.
- Governance log for `write`: `decision:"advisory", phase:"PROPOSED",
  contractStatus:"PROPOSED"` (no block).
- Loop settled at `phase=DONE requirements=2` (both verified), proving advisory
  mode keeps working without an approval prompt.
- The runner stopped the server and removed the fixture after the run.

## Full suite (final code)

```bash
node scripts/run-tests.mjs
```

Result: `4436 tests, 4433 pass, 0 fail, 3 skipped` (158475 ms).

The 8 failures from the first full run were old-behavior assertions (contract
born `APPROVED`, natural-language approval) plus the clarification flow parking
in `PROPOSED`. They were updated to the explicit-approval contract and the
advisory phase normalization (`PROPOSED → IMPLEMENTING` when the contract is
`APPROVED` or the config is advisory).

## Final fresh-session web verification (post phase-normalization)

```bash
npm run verify:web -- --out /tmp/wam-web-e2e-contract-explicit-2
```

- Run: `2026-11-09T20-36-34-808Z-3eacf2f9`
- Result: **PASS**, 11/11 checks.
- Session: `ses_e3df9093affeDPNjiKLVkVtfrp` (fresh `opencode web`, isolated fixture).
- Report: `/tmp/wam-web-e2e-contract-explicit-2/report.md`.
- Check `contract-approved`: `contract.status=PROPOSED approval=advisory`.
- Loop settled at `phase=DONE requirements=2`; roles
  `REVIEWER,BUILDER,ARCHITECT,ANALYST`; skills injected
  `codebase-design,writing-for-agents`.
- Re-run because `index.js` changed after the first web verification; this
  report is the final code.

## Rebuild (final code)

`npm run build` → `Build completed successfully.`
`npx openspec validate --changes --strict` → `171 passed, 0 failed`.
