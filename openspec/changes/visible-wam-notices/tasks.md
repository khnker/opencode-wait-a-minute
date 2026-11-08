# Tasks — Make user-facing WAM notices visible in opencode web

## Phase 1: Pure helpers

- [x] 1.1 Add `src/integration/visible-notices.js`: enqueue (dedupe, cap 5), drain, build synthetic assistant text part with WAM provenance
- [x] 1.2 Add `src/shared/command-args.js`: strip one pair of matching surrounding quotes
- [x] 1.3 Unit tests for the queue, the part shape and the quote stripping

## Phase 2: Wire the plugin

- [x] 2.1 In `index.js`, hold a per-session notice queue and enqueue user-facing notices
- [x] 2.2 Flush the queue as synthetic text parts on the finished assistant message (`message.updated`), fail soft
- [x] 2.3 Clear the queue on `session.deleted`
- [x] 2.4 Pass `queueVisibleNotice` through the `chat.message` deps
- [x] 2.5 Use `stripWrappingQuotes` in `/wam ctx get`

## Phase 3: Enqueue the notices

- [x] 3.1 Enqueue the blocked `⛔` validation text
- [x] 3.2 Enqueue the advisory `notice.completion_gate` text
- [x] 3.3 Enqueue the `notice.task_complete` text

## Phase 4: Regression tests

- [x] 4.1 Handler test: blocked DONE enqueues the block directive
- [x] 4.2 Handler test: allowed DONE enqueues the completion notice
- [x] 4.3 Handler test: a non-DONE message does not enqueue a completion notice

## Phase 5: Validation

- [x] 5.1 Run affected suites with `node --test --test-force-exit`
- [x] 5.2 Run `openspec validate --changes --strict`
- [x] 5.3 Run `npm run build`
- [x] 5.4 Restart `opencode web`, repeat the Playwright block/allow probes, assert the notices are visible in the session body
