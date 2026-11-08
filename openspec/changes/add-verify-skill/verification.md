# Verification: add-verify-skill

## Unit tests

```bash
node --test --test-force-exit \
  tests/unit/verify-skill.test.mjs \
  tests/unit/completion-invariants.test.mjs \
  tests/unit/completion-gate-enforcement.test.mjs \
  tests/unit/completion-gate-evidence.test.mjs \
  tests/unit/completion-gate-e2e.test.mjs \
  tests/unit/verification-completion.test.mjs \
  tests/unit/outcome-completion-gate-seed.test.mjs
```

- 15/15 focused tests pass for the new skill and invariants.
- Existing completion-gate suites also pass; advisory remains the default.

## OpenSpec

`openspec validate --changes --strict`

- 155 passed, 0 failed.

## Build

`npm run build`

- Copied `index.js`, `package.json`, `src/`, `skills/`, `prompts/`, and `vendor/` to `dist/`.

```bash
node -e "import('./dist/index.js').then(m => console.log('dist load OK', Object.keys(m)))"
```

- `dist load OK [ 'default' ]`.

## Fresh-session web E2E

`npm run verify:web` could not approve the WAM contract on opencode `1.19.4`:
the harness sends `/wam contract approve` through `/session/:id/message`, and
that endpoint treats the text as a prompt rather than a slash command. The
session log shows the approval text being injected with WAM context instead of
executing `command.execute.before`.

The same isolated fixture, fresh server, checks, and agent loop were run with
the approval step issuing the real command:

```bash
opencode run --command wam contract approve \
  --session <session-id> --attach <fresh-server-url>
```

- Result: **PASS**, 11/11 checks.
- Run: `2026-11-06T18-14-56-762Z-e51dc376`
- Evidence: `openspec/evidence/web-e2e/2026-11-06T18-14-56-762Z-e51dc376/`
- Skills injected: `craftsman`, `codebase-design`, `writing-for-agents`, `verify`.
- Roles observed: `ANALYST`, `ARCHITECT`, `BUILDER`, `REVIEWER`.
- Agent run settled `COMPLETED`, loop reached `DONE`, completion gate cleared.
- The canonical unit suite and gate tests cover the same runtime invariants;
  the web run confirms the real loop and skill injection still work end to end.
