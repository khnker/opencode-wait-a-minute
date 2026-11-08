# Tasks

- [x] Add `question: false` to `READ_ONLY_TOOLS`.
- [x] Add "Do not ask the user questions; put unknowns in openQuestions." to the role system prompt.
- [x] Assert the tool policy and prompt in `tests/unit/agent-invocation-adapter.test.mjs`.
- [x] Run `node --test --test-force-exit tests/unit/agent-invocation-adapter.test.mjs`.
- [x] Run `npm run build`.
- [x] Validate with `npx openspec validate fix-task-agent-interactive-tools --type change`.
- [x] Verify in a fresh `opencode web` E2E that the loop completes (`report.md` 11/11).
