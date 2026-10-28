# Spec: Chat message hook — WAM parts are never user-authored

## MODIFIED Requirements

### Requirement: Provenance-tagged injection

Every part injected by WAM MUST be tagged with `synthetic:true` and
`metadata.wam:true` plus `wamMessageId`, through a single `injectWamParts`
channel. WAM MUST NOT override the `synthetic` flag to make a part visible as
user text.

#### Scenario: Injected part is tagged

- **GIVEN** any WAM injection
- **WHEN** the part is added to `output.parts`
- **THEN** `isWamSynthetic(part)` is `true` and `hasWamMarkerFor` matches its
  `messageID`

#### Scenario: User text is preserved

- **GIVEN** a user message with text "corrige el bug"
- **WHEN** `chat.message` injects notices, context and a gate
- **THEN** exactly one text part in `output.parts` has `synthetic !== true`
- **AND** that part is the user's original text
- **AND** every WAM part has `synthetic === true`

#### Scenario: Auto-loop directive

- **GIVEN** the automatic completion loop sends a continuation directive
- **WHEN** the prompt is dispatched
- **THEN** its text part carries `synthetic: true`
