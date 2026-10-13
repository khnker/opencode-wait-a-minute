# Design: Centralize and Version WAM Prompts

## Inventory (agent-directed strings in scope)

Confirmed sites (file:line → key → static/interpolated):

**src/policy/discovery-classifier.js**
- `:71` `nudgeFor` grep/rg nudge — static
- `:74` `nudgeFor` glob nudge — static
- `:77` `nudgeFor` read nudge — static
- `:79` `nudgeFor` default nudge — static
- `:87` `workdirSuggestion` — interpolated `${dir}`

**src/execution/runtime-guards.js**
- `:62` redundant-read `nudge` — interpolated `${path}`
- `:162` repetition `warning` — interpolated `${repeated.status}`

**src/integration/message-handler.js**
- `:249` pending-task notice — interpolated `${active}`, `${st.phase}`
- `:251` no-active-task notice — static
- `:269` ASKING blocked directive (with question) — interpolated `${u.id}`, `${u.question}`
- `:270` ASKING blocked directive (generic) — static
- `:274` block rewrite prefix — interpolated `${directive}`
- `:286` new-intent notice — static
- `:340` `[wam N2 task]` header — interpolated `${live}`
- `:341` delegation-lines injection — interpolated

**src/skills/engine.js**
- `:1316` escalation question `¿${a.statement}?` — interpolated
- `:1437` `formatBacklog` header + lines — interpolated
- `:352` `evaluatePersistentPolicies` decision-gate/restrictions text — interpolated

Excluded (documented): `cavemanify` (`:34`) is a transformer (no literal); `prompt-engine.js` is an assembler with no embedded text; `skills/**` handled by skill-registry.

## Architecture

- **Directory**: `prompts/` at repo root, grouped by domain actually present: `nudges/`, `notices/`, `injections/`.
- **Artifact contract**: each file has YAML frontmatter (id, name, purpose, consumer, inputs, output, restrictions, verification, dependencies, status) + body.
- **Catalog**: `prompts/index.json` lists `{id,path,status,consumers,testRefs}`. No instruction text duplicated.
- **Loader**: `src/prompts/loader.js` — module-relative path resolution via `new URL('../../prompts/', import.meta.url)`, in-memory cache, `{{var}}` interpolation (no `eval`; external data never interpreted as template), explicit error on missing file/id/var. Accepts an optional `root` override for tests.
- **Packaging**: `package.json.files` must include `prompts/` so it ships with the plugin.
- **Scripts**: `scripts/prompts-check.mjs`, `scripts/prompts-list.mjs`; wire to `prompts:check` / `prompts:list`.
- **Characterization**: before extraction, capture the exact current strings in tests; after extraction assert equality.
