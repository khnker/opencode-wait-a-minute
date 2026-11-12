# Verification

## Automated tests

```bash
node --test --test-force-exit \
  test/part-provenance.test.mjs \
  test/wam-hidden-parts.test.mjs \
  tests/unit/part-provenance-contract.test.mjs \
  tests/unit/visible-notices.test.mjs \
  tests/unit/wam-chat-visibility.test.mjs
# 30 tests, 30 pass, 0 fail

node --test --test-force-exit \
  tests/unit/skill-pipeline.integration.test.mjs \
  src/context/canonical-project-context.test.mjs \
  src/execution/task-loop.test.mjs
# 44 tests, 44 pass, 0 fail
```

Full suite: `node scripts/run-tests.mjs` → tests 4435, pass 4432, fail 0,
skipped 3.

`openspec validate --changes --strict` → 170 passed, 0 failed.
`npm run build` → pass (dist includes the updated modules).

## Fresh-session web E2E

### Canonical check

```bash
npm run verify:web -- --out /tmp/wam-web-e2e-provider-meta
```

- Result: **PASS**, checks 11/11.
- Run: `2026-11-09T19-54-53-376Z-a3e5cd07`, opencode 1.19.4.
- Session: `ses_e3e1f3d92ffeUDWYqMw7zFTjVO`; phase=DONE requirements=2.
- Report: `/tmp/wam-web-e2e-provider-meta/report.md`.
- Persisted user WAM part metadata is now `{ wam: { synthetic, messageId, phase } }`
  (`main-session.json`, `flatKeys = ["wam"]`).

### Targeted two-turn regression

The canonical run does not send a second prompt, which is the exact trigger of
`AI_InvalidPromptError`. A focused fresh-server check was run with
`/tmp/two-turn-provider-meta2.mjs`: one prompt → patch the assistant text part
with the visible-notice metadata → second prompt.

| Shape | Persisted metadata | Second turn |
| --- | --- | --- |
| old flat (`wam:true`, `wamMessageId`, `wamPhase`) | flat | `UnknownError: Invalid prompt: The messages do not match the ModelMessage[] schema.` |
| new nested (`wam:{synthetic,messageId,phase}`) | nested | `errors: []`, assistant replied `SEGUNDO` |

Flat session: `ses_e3e1b1fd2ffeieodLTecoaI1EP` (reproduces the reported bug).
Nested session: assistant replied `SEGUNDO` with no `InvalidPrompt` error.
Both used a fresh `opencode web` on a free port with an isolated `.wam` fixture,
then the server and fixture were removed.
