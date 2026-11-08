# Tasks: add-unslop-skill

- [x] Vendor unslop under `skills/unslop/` with `LICENSE` + `NOTICE.md`.
- [x] Replace the 31 KB upstream `SKILL.md` with a condensed base skill; keep the
      full text at `references/upstream-skill.md`.
- [x] Add `unslop` to `FRONTEND_ENGINEER` and `UX_DESIGNER`.
- [x] Raise `DEFAULT_MAX_TOTAL_CHARS` to 22000 so `web-design` is not displaced.
- [x] Add `tests/unit/unslop-skill.test.mjs` (vendoring, discovery, role wiring).
- [x] `openspec validate add-unslop-skill --strict`.
- [x] `node --test --test-force-exit tests/unit/unslop-skill.test.mjs tests/unit/agent-role-contracts.test.mjs tests/unit/agent-role-skills.test.mjs`.
- [x] `npm run build`.
- [x] Fresh-session web E2E (`npm run verify:release`, installed package).
