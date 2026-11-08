# Make user-facing WAM notices visible in opencode web

## Why

WAM emits its two most important operator-facing messages — the `⛔` completion
block and the `✅` completion notice — as `synthetic: true` text parts on the
**user** message. The model receives them, but opencode web deliberately filters
synthetic parts out of the user bubble (`UserMessageDisplay` picks the first
non-synthetic text part), so the operator sees neither message directly. The
current guarantee is indirect: the model may relay the notice, or it may not.

The end-to-end probe confirmed the gap: after a blocked DONE the session body
contained no `⛔`, and after an allowed DONE it contained no `✅` completion
notice, even though both parts were persisted.

## What Changes

- Queue user-facing WAM notices (block directive, advisory gate hold, completion
  notice) per session.
- After the assistant message finishes, append each queued notice as a
  `synthetic: true` text part on the **assistant** message. opencode web renders
  synthetic assistant text; it only filters synthetic text in the user bubble.
- Keep the existing synthetic user-message parts untouched, so the model input,
  `extractPrompt`, continuation detection and prompt immutability are unchanged.
- Bound the queue (dedupe, max 5 per session, clear on session delete) and fail
  soft when the part endpoint is unavailable or errors.
- Also strip wrapping quotes in `/wam ctx get "<query>"`, so the documented
  quoted invocation works instead of searching for the literal quotes.

## Impact

- `index.js`: notice queue, assistant-part flush, `chat.message` deps, session
  cleanup, `/wam ctx get` argument normalization.
- `src/integration/message-handler.js`: enqueue the block, advisory and
  completion notices.
- New `src/integration/visible-notices.js` (pure queue/part builders) and
  `src/shared/command-args.js` (quote stripping) so both behaviors are testable.
- Tests: unit coverage for the queue/builders/quote stripping and handler
  assertions that the notices are enqueued.
- No config, schema, migration or model-prompt change.
