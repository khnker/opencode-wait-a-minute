# Design: Enforce Prompt Catalog Integrity
The checker is `scripts/prompts-check.mjs`, which exports `runChecks({ root })` returning `{ ok, violations, count, checks }`. It is importable so tests exercise it without spawning subprocesses, and the CLI entrypoint only runs when executed directly. It reuses `parseFrontmatter` from `src/prompts/loader.js` and the `loadPrompt("<id>")` scan regex approach already used by `scripts/prompts-audit.mjs`.
## Checks
1. **Catalog Structural Validation** — `prompts/index.json` is an array of entries; ids are non-empty and unique; each `path` is relative, ends in `.md`, resolves inside `prompts/` (no `..` escape, no absolute), and the file exists; frontmatter carries all required fields and its `id`/`status` agree with the catalog; every `.md` under `prompts/` (except `README.md`) is registered.
2. **Interpolation Contract** — collect `{{var}}` placeholders from the prompt body with the loader's placeholder regex; every placeholder MUST appear in the file's `inputs` list, and every declared input MUST be used by the body. No undeclared placeholder, no unused input.
3. **Reference Resolution** — each `consumers[]` entry is `path` or `path#symbol`; the file MUST exist, and when `#symbol` is present the file MUST contain the symbol as a whole word (`\bsymbol\b`). Each `testRefs[]` entry MUST resolve to an existing file.
4. **Usage Agreement** — recursively scan `*.js`/`*.mjs` excluding `node_modules`, `vendor`, `.git`, `openspec`, `dist`, `coverage`, dot-directories, `*.test.mjs`, `scripts/prompts-check.mjs` and `scripts/prompts-audit.mjs`; extract ids from `loadPrompt("<id>")` / `loadPrompt('<id>')`; non-literal arguments (variables, template parts) are skipped, not flagged. Every registered id MUST be referenced at least once; every referenced id MUST be registered.
5. **Gate Enforcement** — `npm run prompts:check` returns non-zero on any violation and is invoked as a required step of `scripts/release-gate.mjs`.
## Failure Semantics
`runChecks` never throws on a violation; it accumulates `{ scope, problem }` entries and returns `ok: false`. The CLI prints one `- <file or id>: <problem>` line per violation to stderr and exits `1`. On success it prints `prompts:check: OK (<n> prompts, <m> checks)` and exits `0`. An unreadable or malformed catalog is itself a violation. `--json` emits the violation set as JSON.
## Gate Integration
`scripts/release-gate.mjs` adds `{ name: "Prompt Catalog Integrity", cmd: "npm run prompts:check", required: true }` to its `GATES` list, so a non-zero exit marks the gate `FAIL` and blocks the RC1 verdict.
## Non-Goals
- Rewriting prompt bodies or changing their text: bodies are read-only here (`prompts-check` never mutates files).
- Replacing `scripts/prompts-audit.mjs`: that tool classifies raw literals as migration candidates; this change only enforces catalog agreement.
- Enforcing the *value* of interpolation variables at runtime (that remains the loader's job).
