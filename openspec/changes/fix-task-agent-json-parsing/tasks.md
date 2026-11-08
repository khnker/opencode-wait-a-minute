# Tasks

- [x] Add control-character escaping for JSON string literals.
- [x] Add balanced `{...}` extraction that ignores braces inside strings.
- [x] Update `parseAgentResultText` to try stripped text and extracted objects,
      raw and escaped, returning the first successful parse.
- [x] Preserve `agent response is empty` and `agent response is not valid JSON`
      errors with code `INVALID_RESULT`.
- [x] Add regression tests for fenced raw control characters, surrounding prose,
      prose without an object, and unchanged valid JSON.
- [x] Run `node --test --test-force-exit tests/unit/agent-invocation-adapter.test.mjs`.
- [x] Validate the change with `npx openspec validate fix-task-agent-json-parsing --type change`.
- [x] Run `npm run build`.
- [x] Verify with a fresh `opencode web` E2E (`report.md` 11/11).
