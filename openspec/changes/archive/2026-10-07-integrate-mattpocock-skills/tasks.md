# Implementation Tasks

## Phase 1 — Vendor skill files (3 tasks)

1. Copy `diagnosing-bugs`, `tdd`, `handoff`, `wizard` + `agents/` dirs from `/tmp/mattpocock-skills/skills/` to `skills/`
2. Copy `prototype`, `improve-codebase-architecture`, `codebase-design`, `writing-for-agents` + `agents/` dirs to `skills/`
3. Preprocess each SKILL.md: strip `agents/` subdirectory (keep SKILL.md; `agents/` is Claude-specific harness content irrelevant to WAM/OpenCode)

## Phase 2 — Routing metadata (2 tasks)

4. Extend `builtinCapabilities` in `src/skills/engine.js` (line ~795) with 8 new entries (name, capabilities, triggers, risk, loadStrategy: base|ondemand)
5. Extend `DEFAULT_CONSTRAINTS` in `src/skills/skill-routing.js` (line ~31) with 8 new entries

## Phase 3 — Base selection mechanism (2 tasks)

6. Add `loadStrategy: "base"` support: in `routeSkillsV2`, collect `baseIds` first from registry (skill.metadata?.loadStrategy === "base"), always include them in `selected`, then append scored on-demand candidates
7. Add `loadStrategy` field support in registry entry handling (`buildSkillRegistry`) — pass through `info?.loadStrategy` or `ext?.loadStrategy`

## Phase 4 — Test & validate (3 tasks)

8. Write `tests/skill-loading.test.mjs` covering: base skills selected always; on-demand scoring; trigger match; constraint lookup
9. Run `npm test` (or `node --test tests/`) and fix failures
10. Run `openspec validate --all --strict` to confirm spec compliance
