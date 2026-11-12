# Tasks: Continue on new evidence (remove `/wam resume`)

- [x] Remove the `/wam resume` dispatch block in `index.js`.
- [x] Make the `RESUME_RE` branch in `src/integration/message-handler.js`
      auto-continue a grounded pending task and ask only when none resolves.
- [x] Remove `notice.pending_task` prompt, fixture and `prompts/index.json` entry.
- [x] Update `prompts/README.md` examples that referenced `notice.pending_task`.
- [x] Replace the `notice.pending_task` interpolation test in
      `src/prompts/loader.test.mjs` with an equivalent multi-placeholder prompt.
- [x] Update stop guidance in `src/execution/task-loop.js` and its test.
- [x] Update `tests/unit/plugin-load.test.mjs` to assert auto-continuation.
- [x] Drop `resume` from the WAM command regex in
      `tests/unit/continuation-detection.test.mjs`.
- [x] Run `node --test --test-force-exit` on affected suites, `npm run
      prompts:check`, `openspec validate --changes --strict`, `npm run build`.
- [x] Fresh-session web verification (`npm run verify:web`).
