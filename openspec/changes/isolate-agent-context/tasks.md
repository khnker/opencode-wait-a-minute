# Tasks

## 1. Selector

- [x] 1.1 Add `src/agents/context-isolation.js` with explicit candidate inputs.
- [x] 1.2 Implement role policies for limits and finding severity.
- [x] 1.3 Implement deterministic lexical ranking and stable deduplication.
- [x] 1.4 Enforce per-source item and character budgets with omitted metadata.
- [x] 1.5 Validate inputs and fail loud with every detected issue.

## 2. Isolation

- [x] 2.1 Never accept coordinator conversation, messages or full task state.
- [x] 2.2 Return only Change 01 `AgentRequest.input` fields plus metadata.

## 3. Tests

- [x] 3.1 Cover role limits and Builder/Reviewer finding severity behavior.
- [x] 3.2 Cover lexical ranking, constraint order and stable deduplication.
- [x] 3.3 Cover item and character budgets with omitted counts.
- [x] 3.4 Cover invalid roles, sources, refs and malformed findings.
- [x] 3.5 Verify deterministic output for identical input.

## 4. Validation

- [x] 4.1 Run `node --test --test-force-exit tests/unit/agent-context-isolation.test.mjs`.
- [x] 4.2 Run `openspec validate --changes --strict`.
- [x] 4.3 Run `npm run build` and load-check `dist/`.
