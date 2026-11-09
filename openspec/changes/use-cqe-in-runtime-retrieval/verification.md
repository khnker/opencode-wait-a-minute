# Verification: Use CQE in the runtime retrieval path

## Root cause

- `src/context/context.js:623` (`selectContextWithCqe`) only called CQE when
  `detectFileSearchIntent(task)` matched a keyword regex.
- `src/integration/message-handler.js:763` gated the runtime CQE block with the
  same detector.
- Result: for ordinary prompts the adapter stayed idle even though its mode was
  `enabled`.

## Evidence after the fix

Direct call in this repository with a non-search prompt:

```bash
node -e "import('./src/context/context.js').then(async m=>{
  const p=await m.selectContextWithCqe('analiza porque wam no ocupa cge',{root:process.cwd()});
  console.log(JSON.stringify({files:(p.file_context||[]).length,meta:p.cqeMeta}));
})"
```

Observed: `files: 2`, `meta.source: "cqe"`, `fallbackUsed: false`.

## Suites run

```bash
node --test --test-force-exit \
  tests/integration/cqe/select-context-with-cqe.test.mjs \
  tests/unit/cqe/select-context-cqe.test.mjs \
  tests/unit/ctx-get-cqe.test.mjs \
  test/message-handler.test.mjs
# 30 pass / 0 fail

node --test --test-force-exit \
  tests/unit/context.test.mjs \
  tests/unit/context-assembly.test.mjs \
  tests/unit/multilayer-skill-injection.test.mjs
# 26 pass / 0 fail
```

## Gates

- `npm run build`: pass.
- `openspec validate --changes --strict`: 166 passed, 0 failed.

## Fresh-session web E2E

```bash
npm run verify:web -- --out /tmp/wam-web-e2e-cqe --timeout 180000
# runId: 2026-11-08T22-24-33-942Z-8e538824
# WAM web E2E PASS — checks: 11/11
# report: /tmp/wam-web-e2e-cqe/report.md
```

## Fresh isolated `opencode web` instance (real probe)

A brand-new server (pid `1307864`, port `37707`) was started with `cwd` set to a
throwaway git fixture that contains `src/ledger.js` (`computeLedgerTotal`,
`LEDGER_SCHEMA_VERSION`) and its own `.wam/config.json`. The plugin loaded from
this checkout (global config plugin entry).

- Prompt (no search keyword): `explicá cómo funciona computeLedgerTotal y para qué sirve LEDGER_SCHEMA_VERSION`
- Old `detectFileSearchIntent` applied to that prompt: `false` (the previous code
  would never have called CQE).
- Driven over the real HTTP API: `POST /session` then `POST /session/<sid>/message`
  (session `ses_e42aaef5fffeBTvKOtJZmgH1oA`).
- Persisted task state inside the fixture:

```json
{ "cqeCalls": 1, "cqeStats": { "calls": 1, "ok": 1, "empty": 0, "error": 0, "timeout": 0, "busy": 0, "warming": 0 } }
```

State file: `/tmp/wam-cqe-iso-<run>/.wam/tasks/task-explica-como-funciona-.../task.json`
(i.e. CQE ran against the fixture root and found `ledger.js`).

## Residual risk

- `verify:web` drives the real agent loop and contract lifecycle; it does not
  assert the CQE `file_context` line itself. CQE participation is covered by the
  integration and message-handler regression tests above and by the isolated
  probe counters.
- The injected `[wam cqe file_context: ...]` block is assembled in memory for the
  model turn and is not persisted in the task snapshot; the counters are the
  durable evidence.
- `/wam ctx get` keeps its documented capsule-first precedence; that path is
  out of scope for this change.
