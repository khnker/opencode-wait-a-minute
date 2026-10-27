# Tasks: Bound noisy N1 context and recompute N2 next action

- [x] 1. Add `src/state/next-action.js`; re-export from orchestration.
- [x] 2. Recompute N2 `next` from requirements in `assembly.js`.
- [x] 3. Cap decisions to 2 sections x 240 chars (500 total).
- [x] 4. Cap recent changes to 2 sections x 240 chars.
- [x] 5. Read `WAM_CHARS_PER_TOKEN` in `estTokens`.
- [x] 6. Add tests for completion detection and stale-N2 recompute.
- [x] 7. Run affected suites, `npm run build`, `openspec validate --changes --strict`.
