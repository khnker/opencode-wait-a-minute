# Tasks: Add agentic-code-foundations skill

## 1. Skill file
- [x] Create `skills/agentic-code-foundations/SKILL.md` with frontmatter and rules
- [x] Document the meaningful-limitations convention (`shortcut: <limitation>; upgrade when <condition>`)

## 2. Routing metadata
- [x] Add id to `builtinCapabilities` in `src/skills/engine.js` (capabilities, triggers, risk low)
- [x] Keep default on-demand load strategy (no `loadStrategy: "base"`)
- [x] Add cross-layer constraint in `DEFAULT_CONSTRAINTS` (`src/skills/skill-routing.js`)

## 3. Tests
- [x] Create `tests/unit/agentic-code-foundations.test.mjs`
- [x] Assert discovery path, registry shape/content, routing selection, constraint

## 4. Validation
- [x] `node --test --test-force-exit` on the new test plus skill-injection suites
- [x] `npm run build`
- [x] Load-check `dist/`
- [x] `openspec validate --changes --strict`

## 5. Security
- [x] Confirm static markdown + metadata strings only; no secrets, eval, network, or path interpolation
