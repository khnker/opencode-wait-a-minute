# Tasks

- [x] Add V10 (Craftsman review) to `skills/verify/SKILL.md`.
- [x] Add the "Craftsman review of the diff" procedure step and completion condition.
- [x] Add workflow step 5b to `AGENTS.md`.
- [x] Add a regression test in `tests/unit/verify-skill.test.mjs`.
- [x] Run `node --test --test-force-exit tests/unit/verify-skill.test.mjs tests/unit/craftsman.test.mjs` (14 passed).
- [x] Run `openspec validate add-craftsman-review-to-done --strict` and `npm run build` (both pass).

## Validation note
Skill-content-only change: unit tests, strict OpenSpec validation, build and
`node --check dist/index.js` passed. Fresh-session `verify:web` was not run in
this environment; it should be run before release.
