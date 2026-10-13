# Tasks: Enforce Prompt Catalog Integrity

- [x] 1. Author `proposal.md`, `design.md`, `tasks.md` and the delta spec for the change.
- [x] 2. Extend `scripts/prompts-check.mjs` with an importable `runChecks({ root })` covering structural, interpolation, reference and usage checks.
- [x] 3. Add catalog structural validation (unique ids, relative `.md` path confined to `prompts/`, file existence, required frontmatter, unregistered files).
- [x] 4. Add the interpolation contract (every `{{var}}` declared, every declared input used).
- [x] 5. Add reference resolution for `consumers[]` (`path` / `path#symbol`) and `testRefs[]`.
- [x] 6. Add the usage agreement scan (orphan prompts and unregistered `loadPrompt` ids).
- [x] 7. Preserve the CLI: `--json`, non-zero exit on violations, `prompts:check: OK (<n> prompts, <m> checks)` on success.
- [x] 8. Create `scripts/prompts-check.test.mjs` with temp-dir fixtures for every failure path plus the happy path.
- [x] 9. Wire `npm run prompts:check` as a required step of `scripts/release-gate.mjs`.
- [x] 10. Verify: `node scripts/prompts-check.mjs`, `node --test scripts/prompts-check.test.mjs`, `openspec validate enforce-prompt-catalog-integrity`.
