# chat-message-hook delta

## MODIFIED Requirements

### Requirement: Provenance-tagged injection

Every part injected by WAM MUST be tagged with `synthetic:true` and a
`metadata.wam` record carrying `synthetic`, `messageId` and `phase`, through a
single `injectWamParts` channel. The `metadata` object MUST satisfy OpenCode's
provider-metadata contract (`Record<string, Record<string, JSONValue>>`) so it
can be forwarded as AI SDK `providerOptions` without rejecting the prompt.

#### Scenario: Injected part is tagged

- **GIVEN** any WAM injection
- **WHEN** the part is added to `output.parts`
- **THEN** `isWamSynthetic(part)` is `true` and `hasWamMarkerFor` matches its
  `messageID`.

#### Scenario: Metadata is provider-options safe

- **GIVEN** a WAM synthetic text part persisted on an assistant message
- **WHEN** OpenCode converts it into an AI SDK model message
- **THEN** every top-level `metadata` value is a JSON object and the prompt is
  accepted instead of failing with `AI_InvalidPromptError`.
