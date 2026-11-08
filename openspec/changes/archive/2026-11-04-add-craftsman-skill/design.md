# Design: Add craftsman skill

## Research
- OpenCode skills documentation — frontmatter (`name`, `description`), discovery from
  `SKILL.md` directories: https://opencode.ai/docs/skills/
- Agent Skills specification — portable skill layout and metadata contract:
  https://agentskills.io/specification
- Local discovery implementation: `src/policy/skill-routing.js` (`discoverSkills` scans
  `skills/<id>/SKILL.md` across tiers; frontmatter is not parsed for routing).
- Routing metadata contract: `src/skills/engine.js` (`builtinCapabilities` maps skill id
  → capabilities/triggers/risk; load strategy defaults to on-demand).
- Precedent: `openspec/changes/add-agentic-code-foundations-skill/`.
- Local failure observed with the real assembler: `pruneBySection` ended a section at
  the first blank line (`content.indexOf("\n\n", m.index)`), so long skills injected
  headings only; the 1200-char on-demand cap also excluded the Craftsman Ladder
  (starts at char 1594).

## Alternatives considered
1. **Base injection vs on-demand.** Chosen: on-demand. Base injection costs tokens on
   every prompt and Craftsman is only relevant to code-writing/refactoring tasks.
2. **Merge into `agentic-code-foundations` vs separate skill.** Chosen: separate.
   Foundations states principles; Craftsman provides a decision ladder (locality →
   repetition → native → pure core → polymorphic justification) and a diff audit, with
   distinct triggers (`implement`, `refactor`, `software design`). Keeping them separate
   avoids bloating one document and lets routing select each independently.
3. **Depend on Ponytail vs self-contained protocol.** Chosen: self-contained text. The
   skill references Ponytail principles conceptually but adds no runtime or package
   dependency.
4. **Compact the skill to 1200 chars vs fix pruning and raise the on-demand cap.**
   Chosen: fix pruning and cap. Compacting would delete the decision ladder that is the
   skill's purpose; the pruning bug affects every long on-demand skill.
5. **Slice each section to the next heading vs the first blank line.** Chosen: next
   heading. It preserves the section body and lets ranking keep whole sections; the
   preamble before the first heading is retained for synthetic tags.
6. **Fixed 4000-char default vs token-budget-derived bound.** Chosen: remove the fixed
   default and bound each on-demand skill by the remaining skill token budget. A fixed
   char cap truncated valid skills and forced section ranking to drop content; the token
   budget is the real context limit. An explicit `skillsMaxChars` still acts as a hard
   character cap for operators.
7. **Base cards by default vs full bodies by default.** Chosen: full bodies by default
   across projects; `skillBaseLoad: "card"` is the opt-out for compact prompts. Cards
   dropped most of the base instructions, and the user asked for transversal behavior.
8. **40% vs 80% of flex for skills.** Chosen: 80%, reserving 20% for design and other
   optional context. The former 40% share truncated skills that otherwise fit; skill
   count is bounded (3-5 on-demand plus base) but bodies are not, so unbounded injection
   was rejected: one oversized skill could starve state and design context.

## Approach
- Ship `skills/craftsman/SKILL.md` with `name` + `description` (plus author-provided
  `tools`/`user-invocable`/`argument-hint` metadata, inert for WAM routing).
- Register capabilities/triggers/risk in `builtinCapabilities`, keep on-demand loading.
- Add a permissive cross-layer constraint so layer checks never block the skill.
- Cover discovery, registry shape, routing selection, and constraints with one test file.
- Preserve the preamble (synthetic `[wam N3 skill]` header) when a skill line is pruned.
- Inject the full skill body by default for both on-demand and base skills; base skills
  opt back into compact cards with `skillBaseLoad: "card"`. Prune only when an explicit
  `skillsMaxChars` is configured or the remaining skill token budget is exceeded.
- Derive the fallback trim from `skillBudget - skillSpent` and the line's own
  chars/token ratio, not from a fixed 4000-char constant.
- Allocate up to 80% of remaining flex to skills (`SKILL_FLEX_SHARE`), keeping 20% for
  design and other optional context.

## Risks / limitations
- Keyword-trigger routing is literal: generic words ("implement", "model") can mis-route
  unrelated prompts. Mitigated by `minSkillScore` in normal routing and risk `low`
  (read-only guidance).
- The skill is guidance text, so its effect is not mechanically testable; tests assert
  discoverability, routing, and that the ladder body reaches N3, not output quality.
- Operators can still set `skillsMaxChars` explicitly; in that case sections are ranked
  by the selection reason and low-relevance sections may be omitted.
- With no explicit cap, skill injection can be large; the token budget and
  `skillBudget` (80% of flex, 20% reserved) remain the hard bounds.
