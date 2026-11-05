## 1. Implementation

- [x] Add `scripts/verify-web-e2e.ts` with pure helpers and a guarded `main()`.
- [x] Add `verify:web` to `package.json`.
- [x] Emit `report.json`, `report.md`, redacted logs and state copies.
- [x] Default reports to durable `openspec/evidence/web-e2e/<runId>`; add
  `--ephemeral` for tmp smoke runs.
- [x] Align `engines.node` to `>=22.6` and publish the runner in `files`.

## 2. Tests

- [x] Add `tests/unit/verify-web-e2e.test.mjs` covering args, config, task
  selection, checks, redaction and markdown.
- [x] Run `node --test --test-force-exit tests/unit/verify-web-e2e.test.mjs`.

## 3. Real verification

- [x] Run `npm run verify:web -- --out <tmp>` against the real `opencode web`.
- [x] Confirm the report records a completed loop or a surfaced failure.
- [x] Run `npx openspec validate --changes --strict` and `npm run build`.
