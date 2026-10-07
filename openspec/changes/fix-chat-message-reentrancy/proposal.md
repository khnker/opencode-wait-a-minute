# Fix chat.message Re-entrancy — Proposal

## Why
The `chat.message` hook was non-idempotent and read its own injected output as
input. `extractPrompt` preferred `output.parts`, and WAM writes its synthetic
injections there (`emitTextPart`, `presentValidation`). On any re-invocation
(retry/replay) WAM re-consumed its own injection as a fresh prompt and
re-injected it, growing the message unbounded until the session hung and
repeated text indefinitely.

## What Changes
- **New** `src/integration/part-provenance.js`: a single tagged injection
  channel — `tagWamPart`, `injectWamParts`, `isWamSynthetic`,
  `hasWamMarkerFor`. Every injected part carries
  `synthetic:true` + `metadata.wam:true` + `wamMessageId`.
- `emitTextPart` (`index.js`) routes through `injectWamParts` (provenance).
- `extractPrompt` reads **only** the user's input parts and filters synthetic
  parts; it never reads `output.parts`.
- `handleMessage` gains an idempotency guard keyed by `messageID` + kind
  (`prompt` / `tool`), backed by a bounded in-memory LRU **plus** provenance
  markers (survives plugin reload).
- Removed the dead duplicate `extractPrompt` in `index.js` (was a duplicate
  declaration / dead code).

## Impact
- Fixes the infinite repetition / session hang.
- No behavior change to blocking (AC5 in-place rewrite) or to tool-result state
  capture — the guard only prevents re-processing the same message.
- New exports: `isMessageAlreadyProcessed`, `_resetProcessedMessages`.
