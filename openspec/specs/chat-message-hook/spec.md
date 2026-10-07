# chat-message-hook Specification

## Purpose
TBD - created by archiving change fix-chat-message-reentrancy. Update Purpose after archive.
## Requirements
### Requirement: Idempotent chat.message processing
The `chat.message` handler MUST process each message at most once per
`messageID` and kind (`prompt` / `tool`). Re-invocation for the same message
MUST be a no-op and MUST NOT add parts or re-run analysis.

#### Scenario: Duplicate invocation
- **GIVEN** a message with `messageID = "m1"`
- **WHEN** `handleMessage` is invoked twice for `m1`
- **THEN** the second invocation returns early and injects nothing.

### Requirement: Prompt read isolation
`extractPrompt` MUST read the prompt only from the user's input parts and MUST
ignore parts tagged as WAM-synthetic. It MUST NOT read `output.parts`.

#### Scenario: Synthetic part present
- **GIVEN** `input.message.parts` containing a WAM-synthetic part and a real
  text part
- **WHEN** `extractPrompt(input, output)` is called
- **THEN** it returns the real text part, never the synthetic one.

#### Scenario: Output-only parts
- **GIVEN** an `output.parts` array with text and an empty `input.message.parts`
- **WHEN** `extractPrompt(input, output)` is called
- **THEN** it returns an empty string.

### Requirement: Provenance-tagged injection
Every part injected by WAM MUST be tagged with `synthetic:true` and
`metadata.wam:true` plus `wamMessageId`, through a single `injectWamParts`
channel.

#### Scenario: Injected part is tagged
- **GIVEN** any WAM injection
- **WHEN** the part is added to `output.parts`
- **THEN** `isWamSynthetic(part)` is `true` and `hasWamMarkerFor` matches its
  `messageID`.

