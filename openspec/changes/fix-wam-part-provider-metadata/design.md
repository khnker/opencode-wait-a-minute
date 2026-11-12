# Design: provider-safe WAM part provenance

## Research

- OpenCode v1.19.4 `packages/opencode/src/session/message-v2.ts`: for assistant
  text parts it builds `{ type:"text", text, providerMetadata: part.metadata }`
  (line ~293). The persisted `metadata` field is forwarded verbatim as AI SDK
  `providerMetadata` / `providerOptions`.
- AI SDK prompt types require
  `providerOptions: Record<string, Record<string, JSONValue>>`; a non-record
  value produces `AI_TypeValidationError`. Reference:
  https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#provider-options
- OpenCode's own assistant reasoning metadata follows the same convention by
  namespacing under the provider (`metadata.anthropic.signature`), confirming
  that each top-level key must be an object.
- Reproduced error: `AI_InvalidPromptError` at `content[6]` of an assistant
  message whose part carried
  `providerOptions: { wam:true, wamMessageId:"...", wamPhase:"visible-notice" }`.

## Alternatives considered

1. **Mark notices `ignored: true`.** Rejected: v1.19.4 only honors `ignored`
   for user text parts (`!part.ignored`), not assistant text parts, so it would
   not stop the crash; and the plugin intentionally wants the model to receive
   synthetic notices (`index.js` `emitTextPart` comment).
2. **Drop `metadata` from injected parts and rely on `synthetic: true`.**
   Rejected: `hasWamMarkerFor` needs the originating `messageId`, and dropping
   the marker weakens the re-entrancy guard.
3. **Namespace WAM provenance under a `wam` object (chosen).** Keeps all
   provenance fields, satisfies the provider-options schema, and matches
   OpenCode's provider-namespaced metadata convention.

## Decision

`tagWamPart` sets:

```js
metadata: {
  ...(source.metadata || {}),
  wam: { synthetic: true, messageId, phase },
}
```

`isWamSynthetic` checks truthiness of `metadata.wam`; `hasWamMarkerFor` reads
`metadata.wam.messageId`. `wamMetadata()` centralizes the shape so
`src/execution/task-loop.js` uses it too.

## Risks

- External consumers reading the old flat keys would break; none exist in the
  runtime (`isWamSynthetic`/`hasWamMarkerFor` are the only readers).
- Source-provided `metadata` is still spread at the top level; callers must not
  pass primitive values. Current producers pass none or the WAM record.
