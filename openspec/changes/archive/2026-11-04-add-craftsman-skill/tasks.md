# Tasks: Add craftsman skill

## 1. Skill content
- [x] Create `skills/craftsman/SKILL.md` with invariants, Craftsman Ladder, implementation rules, diff audit and output contract

## 2. Routing metadata
- [x] Add id to `builtinCapabilities` in `src/skills/engine.js` (capabilities, triggers, risk low)
- [x] Keep default on-demand load strategy (no `loadStrategy: "base"`)
- [x] Add cross-layer constraint in `DEFAULT_CONSTRAINTS` (`src/skills/skill-routing.js`)

## 3. Tests
- [x] Create `tests/unit/craftsman.test.mjs`
- [x] Assert discovery path, registry shape/content, routing selection, constraint

## 4. Validation
- [x] `node --test --test-force-exit tests/unit/craftsman.test.mjs`
- [x] `npm run build` and load-check `dist/`
- [x] `openspec validate --changes --strict`

## 5. Security
- [x] Confirm static markdown + metadata strings only; no secrets, eval, network, or path interpolation

## 6. Injection fix
- [x] Fix `pruneBySection` to end sections at the next heading and preserve the preamble
- [x] Remove the fixed 4000-char on-demand cap
- [x] Inject the full body by default; prune only by explicit `skillsMaxChars` or remaining skill token budget (80% of flex, 20% reserved)
- [x] Make full base-skill bodies the default; keep `skillBaseLoad: "card"` as opt-out
- [x] Add regression asserting the full Craftsman body reaches N3 without truncation
- [x] Run `node --test --test-force-exit tests/unit/craftsman.test.mjs src/context/assembly.test.mjs`
