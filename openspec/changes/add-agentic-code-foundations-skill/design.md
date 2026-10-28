# Design: Add agentic-code-foundations skill

## Research
- OpenCode skills documentation — frontmatter (`name`, `description`), discovery from
  `SKILL.md` directories: https://opencode.ai/docs/skills/
- Agent Skills specification — portable skill layout and metadata contract:
  https://agentskills.io/specification
- Local discovery implementation: `src/policy/skill-routing.js:66-104` (`discoverSkills`
  scans `skills/<id>/SKILL.md` across tiers and does **not** parse frontmatter).
- Routing metadata contract: `src/skills/engine.js:1003-1031` (`builtinCapabilities` maps
  skill id → capabilities/triggers/risk/loadStrategy).

## Alternatives considered
1. **Base injection vs on-demand vs hooking every prompt.** Chosen: on-demand. Base
   injection costs tokens every single turn for a skill that only matters during refactor
   or review work; hooking every prompt would double injection cost and blur routing.
2. **`skills/registry.json` vs `builtinCapabilities`.** Chosen: `builtinCapabilities`.
   `registry.json` is an upstream catalog mirror; locally bundled skills are discovered
   from the filesystem, so adding a local id there would be inert metadata.
3. **Frontmatter `metadata` vs engine map.** Chosen: engine map. Discovery in this repo
   does not parse frontmatter, so capabilities/triggers must live in the engine to be
   routable; frontmatter only carries `name`/`description`.

## Decision
- Create the skill as a plain markdown file under `skills/<id>/SKILL.md`.
- Register capabilities/triggers/risk in `builtinCapabilities`, default load strategy
  (on-demand).
- Add a permissive cross-layer constraint so the skill is never blocked by layer checks.
- Cover discovery, registry shape, routing selection, and constraints with one test file.

## Risks / limitations
- Keyword-trigger routing is literal: generic words ("refactor", "abstraction") can
  mis-route unrelated prompts. There is no semantic inference. Mitigated by
  `minSkillScore 4` in normal routing and by keeping risk `low` (read-only guidance).
- The skill is guidance text, so its effect is not mechanically testable; tests assert
  discoverability and routing, not output quality.
