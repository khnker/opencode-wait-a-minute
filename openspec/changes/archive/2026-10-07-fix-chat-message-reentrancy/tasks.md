# Fix chat.message Re-entrancy — Tasks

## Implementation
- [x] Add `src/integration/part-provenance.js` (tag/inject/predicate helpers).
- [x] `index.js`: `emitTextPart` delegates to `injectWamParts` (tagged).
- [x] `index.js`: remove dead duplicate `extractPrompt` declaration.
- [x] `message-handler.js`: import provenance helpers.
- [x] `message-handler.js`: bounded LRU + `markProcessed` + `_resetProcessedMessages`.
- [x] `message-handler.js`: `isMessageAlreadyProcessed(input, output)` predicate.
- [x] `message-handler.js`: idempotency guard at the top of `handleMessage`.
- [x] `message-handler.js`: `extractPrompt` reads input-only, filters synthetic.

## Tests
- [x] `test/part-provenance.test.mjs` — tagging, predicate, sink behavior.
- [x] `test/message-handler-idempotency.test.mjs` — extractPrompt input-only,
      synthetic filtering, guard predicate, double-invocation no-op.

## Verification
- [x] `node --check` on `index.js`, `message-handler.js`, `part-provenance.js`.
- [x] `npm test` green — 2630/2630 pass, 0 fail (no regressions).
- [x] `npm run gate` — RC1 READY (11/11 checks PASS).
