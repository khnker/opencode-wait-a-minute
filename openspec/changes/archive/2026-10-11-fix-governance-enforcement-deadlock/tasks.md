# Tasks
## Implementation
- [x] Rewrite `src/policy/governance-enforcement.js` (fail-open untracked, subagent exemption, trivial-change, override, terminal/ASKING, logging).
- [x] Robust parentID detection (`parentID`/`parent_id`/`parent.id`) + `sessionResolved`; fail-open on unresolved sessions.
- [x] Replace the inline gate in `index.js` with a call to `enforceGovernance`; fix the corrupted directive string.
- [x] Expose `CONTRACT_GATED_TOOLS`, `TERMINAL_PHASES`, `isTrivialChange`, `isTerminalPhase`, `isProtectedPath` (testable).
## Validation
- [x] `node --test tests/unit/governance-enforcement.test.mjs` passes (12/12)
- [x] `node scripts/run-tests.mjs` passes (2633 pass / 0 fail)
- [x] `node -e "import('./index.js')..."` loads

## Follow-up (skill pipeline coverage + cleanup)
- [x] Integration test `tests/unit/skill-pipeline.integration.test.mjs`: detect -> select -> inject against the real bundled catalog (`skills/registry.json`).
- [x] Removed dead local `MUTATING_TOOLS` const and the obsolete commented delegation block in `index.js`.
## Final Validation
- [x] `node --test tests/unit/skill-pipeline.integration.test.mjs` passes (10/10)
- [x] `node scripts/run-tests.mjs` passes (2643 pass / 0 fail)
- [x] `node -e "import('./index.js')"` loads

## Follow-up fixes (skill pipeline hardening)
- [x] Fix #1: local skills now embed `SKILL.md` content at registry build-time (`readSkillContent` in `src/skills/engine.js`) so N3 injection + on-demand load work like bundled skills.
- [x] Fix #2: `analyze(options = {})` + `prompt = ""` default; `classifyRequest`/`routeSkillsV2` guard non-string prompt (`String(prompt ?? "")`).
- [x] Fix #3: removed stray `console.log("--- DEBUG: Tracer instanciado...")` in `routeSkillsV2`.
- [x] Tests: `tests/unit/skill-pipeline.integration.test.mjs` extended to 12 tests (bundled + local content paths).

## Follow-up fix (pre-existing packaging gate break)
- [x] Fix #4: `scripts/package-e2e.mjs` + `tests/e2e/opencode/smoke.mjs` hardcoded `node_modules/wait-a-minute` but the package was renamed to `opencode-wait-a-minute` (commit 92c224d) -> both E2E gates failed at HEAD. Both now derive the dir from `package.json#name`.
- [x] `npm run gate` -> RC1 READY (11/11 gates PASS, 0 skipped).
