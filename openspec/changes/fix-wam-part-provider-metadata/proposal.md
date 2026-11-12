# Fix WAM part metadata breaking OpenCode prompts

## Why

WAM tags every injected part with provenance inside the part's `metadata` field
using flat keys (`metadata.wam: true`, `metadata.wamMessageId`,
`metadata.wamPhase`). OpenCode forwards a text part's `metadata` to the AI SDK
as `providerOptions`, whose schema is
`Record<string, Record<string, JSONValue>>`. The flat boolean/string values fail
that schema, so the next prompt is rejected with
`AI_InvalidPromptError: Invalid prompt: The messages do not match the
ModelMessage[] schema` (`invalid_type path=["providerOptions","wam"] exp=record`).

This reproduces on any assistant message that received a synthetic WAM notice
(`phase: "visible-notice"`): the part persists, and every later turn sends it
back to the model until the session breaks.

## What Changes

- Namespace WAM provenance under `metadata.wam` as a JSON object
  (`{ synthetic, messageId, phase }`) so it satisfies OpenCode's
  provider-options contract.
- Update `isWamSynthetic` / `hasWamMarkerFor` and every producer to the nested
  shape.
- Add a regression test asserting every top-level `metadata` value is a JSON
  object.

## Impact

- Affected specs: `chat-message-hook` (provenance-tagged injection).
- Affected code: `src/integration/part-provenance.js`,
  `src/execution/task-loop.js`, and the tests that assert the metadata shape.
- No change to user-visible behavior: notices stay visible and still reach the
  model (the `synthetic` part policy is unchanged).
