# Tasks: Prompt Source-of-Truth Audit
- [x] 1. Implement audit scanner (`scripts/prompts-audit.mjs`): recursive `*.js`/`*.mjs` walk with exclusions and catalog loading.
- [x] 2. Implement classification: `centralized` (via `loadPrompt`), `candidate`, and explicit `deterministic` patterns; never auto-migrate.
- [x] 3. Implement cross-reference: orphan prompts, stale consumer refs, and duplicate candidates.
- [x] 4. Implement report: deterministic Markdown default and `--json`, `--strict`, `--out`.
- [x] 5. Add tests (`scripts/prompts-audit.test.mjs`) for determinism and detection of the `src/context/assembly.js` raw literals.
- [x] 6. Wire npm script `prompts:audit`.
- [x] 7. Verify: `node scripts/prompts-audit.mjs` (exit 0), `--json` parses, `openspec validate prompt-source-of-truth-audit` valid.
