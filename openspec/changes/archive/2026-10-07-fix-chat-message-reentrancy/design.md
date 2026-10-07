# Fix chat.message Re-entrancy — Design

## Invariant
> `chat.message` is a pure, idempotent function of the immutable user input.
> It reads the prompt **only** from `input` (never `output.parts`), writes
> injections **only** to `output` through one provenance-tagged channel, and
> re-running it for the same `messageID` is a no-op.

## Root cause
- `emitTextPart` wrote synthetic text into `output.parts` (`unshift`).
- `presentValidation` wrote into `ctx.parts` (`unshift` + `push`) and `ctx.system`.
- `extractPrompt` read `output.parts` **first**.
- `handleMessage` had no idempotency guard and no synthetic filter.

On re-invocation WAM consumed its own injection as the user prompt and
re-injected → unbounded growth → hang + text repetition.

## Pillars
1. **Canonical read** — `extractPrompt` reads `input.message.parts` /
   `input.parts` / `input.text` and skips `isWamSynthetic(p)`. Never
   `output.parts`.
2. **Single tagged channel** — `injectWamParts` is the only writer; every part
   gets `synthetic:true` + `metadata.wam:true` + `wamMessageId` + `wamPhase`.
3. **Idempotency** — `isMessageAlreadyProcessed` checks a bounded LRU keyed
   `${messageID}:${kind}` **and** provenance markers on `output.parts` /
   `input.message.parts`. The guard runs before any analysis; the key is set
   immediately so a partial failure still converges.
4. **Bounded state** — LRU capped at 1000 keys (evict oldest) to avoid
   unbounded growth across a long session.

## Non-goals
- The in-place rewrite of the user's prompt on a blocking (AC5) branch is
  intentional product behavior and is preserved.
