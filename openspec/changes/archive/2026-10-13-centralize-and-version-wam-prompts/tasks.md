# Tasks: Centralize and Version WAM Prompts

- [x] 1. Characterization tests: capture exact current strings + interpolation outputs for all in-scope sites.
- [x] 2. Create `prompts/` structure (`nudges/`, `notices/`, `injections/`) + `README.md` (maintenance guide).
- [x] 3. Author each prompt Markdown file with frontmatter metadata and verbatim body.
- [x] 4. Create `prompts/index.json` catalog with id/path/status/consumers/testRefs.
- [x] 5. Implement `src/prompts/loader.js` (module-relative resolution, cache, `{{var}}` interpolation, explicit errors).
- [x] 6. Implement `scripts/prompts-check.mjs` and `scripts/prompts-list.mjs`; wire `prompts:check` / `prompts:list`.
- [x] 7. Add `prompts/` to `package.json.files`.
- [x] 8. Migrate consumers (discovery-classifier, runtime-guards, message-handler, skills/engine) to load via the loader.
- [x] 9. Add loader tests (load, interpolation, missing var, missing file, unknown id, catalog integrity).
- [x] 10. Update maintenance docs (`prompts/README.md`).
- [x] 11. Verify: characterization passes, `prompts:check` clean, `npm test`, `openspec validate --changes`.
- [x] 12. Deliver inventory of migrated/retired/duplicated/pending prompts.
