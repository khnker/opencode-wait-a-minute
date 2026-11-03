# Tasks — start the agent loop early

## 1. Implementation

- [x] 1.1 Add `classifyExecutionIntent` for `IMPLEMENT`, `ANALYZE`, `INLINE`.
- [x] 1.2 Persist `executionIntent` and `executionGate` in the message handler.
- [x] 1.3 Start `runTaskAgentPass` from `chat.message` without awaiting it.
- [x] 1.4 Extract the agent pass from `maybeTaskLoop` and clear the gate in
      `finally`; keep `session.idle` as fallback.
- [x] 1.5 Block mutating tools on the main session while the gate is active.
- [x] 1.6 Add the read-only `ANALYZE` pipeline without `BUILDER`.
- [x] 1.7 Normalize `APPROVED + PROPOSED` to `IMPLEMENTING`.

## 2. Tests

- [x] 2.1 Classifier covers analysis prompts, implementation prompts, and
      trivial/inline edits.
- [x] 2.2 Gate blocks `write`/`edit` and mutating shell commands but not reads.
- [x] 2.3 `ANALYZE` invokes `ANALYST → ARCHITECT → REVIEWER` and never `BUILDER`.
- [x] 2.4 An approved contract no longer stays in `PROPOSED`.
- [x] 2.5 `runTaskAgentPass` clears the gate after success and failure.

## 3. Validation

- [x] 3.1 `node --test --test-force-exit <affected files>`
- [x] 3.2 `node scripts/run-tests.mjs`
- [x] 3.3 `npx openspec validate --changes --strict`
- [x] 3.4 `npm run build` and load `dist/index.js`
