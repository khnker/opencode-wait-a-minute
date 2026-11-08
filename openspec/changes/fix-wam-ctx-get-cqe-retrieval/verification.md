# Verification

## Automated tests

```bash
node --test --test-force-exit \
  tests/unit/ctx-get-cqe.test.mjs \
  tests/unit/context.test.mjs \
  tests/unit/cqe-first-discovery.test.mjs \
  src/context/assembly.test.mjs \
  tests/unit/runtime-context-graph.test.mjs \
  tests/unit/cqe/select-context-cqe.test.mjs \
  tests/unit/cqe/cqe-adapter.test.mjs
# 58 tests, 58 pass, 0 fail
```

## Fresh-session web E2E

- Fixture: `/tmp/wam-ctxget-web-eRgZQb` (isolated `.wam`, no capsules, `subtract.js`
  containing `CQE_CTX_UNIQUE_TOKEN`).
- Server: `opencode web --port 44043 --hostname 127.0.0.1`, started fresh after the
  change, cwd = fixture.
- Session: `ses_e56b9691dffetrIKxhy6Au5Ij3`.
- Command path: `POST /session/<sid>/command` with
  `{"command":"wam","arguments":"ctx get \"subtract\""}`.
- Evidence persisted in `/tmp/wam-ctxget-web-1793841336820/message-texts.txt`:
  `[wam] [cqe] subtract.js:2 (rel 1.00) export function subtract(a, b) { return a - b; }`
- Assertions: `hasCqeFile: true`, `hasSinCapsulas: false`.
- Server stopped after the run; the fixture contains no capsule files.
