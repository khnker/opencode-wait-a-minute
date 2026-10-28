# Proposal: Stop WAM from overwriting and impersonating the user's message

## Problem

In a live session (`ses_e8ba46cbdffeSEoZEtKVjce2qB`) the user typed a short
instruction and the chat rendered WAM notices as the body of *their* message.
36 of 83 user messages in that session carried injected WAM parts, up to 7
parts per message, and several carried a completion gate that quoted
`Acción solicitada por el usuario: "Listo, continúa"` even though the user
never wrote that.

Root causes found in the code:

1. `emitTextPart` (`index.js:177`) passes `synthetic: false` to
   `injectWamParts` and `position: "prepend"`. OpenCode's UI picks the first
   **non-synthetic** text part as the user message body
   (`packages/session-ui/src/components/message-part.tsx:1199`), so every WAM
   notice prepended to `output.parts` replaces what the user typed.
2. `buildCompletionValidation` (`src/integration/orchestration.js:302`) quotes
   the hardcoded constant `COMPLETION_GATE_REQUESTED_ACTION = "Listo, continúa"`
   as if the user had asked for it.
3. The gate notice is emitted on every non-trivial turn
   (`src/integration/message-handler.js:783`), so a contract from an older task
   is re-pasted into unrelated turns.
4. The auto-loop sends its internal directive through `client.session.prompt`
   without `synthetic: true`, creating a message that reads as user-authored.
5. After restarting with the fix, a *new* defect surfaced in a live session:
   the user wrote "listo sigue" (a continuation) and WAM classified it as a
   completion claim, then synthesized a contract whose only requirement was
   the literal text "Listo sigue" — unclosable, so the gate blocked forever.
   `isCompletionIntent` matched the leading "listo" and `synthesizeContract`
   did not recognize the ack+continuation form as meta.

This also violates the existing `chat-message-hook` spec, which already
requires every injected part to be `synthetic:true`.

## What changes

- All WAM parts are injected as `synthetic:true` (the single `injectWamParts`
  channel already defaults to it); the `synthetic:false` override is removed.
- The completion validation quotes the contract objective instead of inventing
  a user utterance; the `COMPLETION_GATE_REQUESTED_ACTION` constant is removed.
- The completion gate is only *shown* on a completion claim. Evaluation stays
  per-turn for adversarial checks.
- The auto-loop directive is sent as a synthetic part and no longer starts with
  a fake `Listo, continúa` user sentence.
- Continuation prompts (optionally ack-prefixed: "listo sigue", "ok, continúa")
  are classified by one predicate (`isContinuationInstruction`), are never
  completion claims, and never produce contract requirements.
- Regression tests assert the user text is the only non-synthetic part.

## Impact

- The user's text is never replaced or attributed to WAM.
- The model still receives WAM context (synthetic parts remain in the message
  and are sent to the LLM).
- WAM notices remain visible in `.wam` logs and the final summary.
- No API or storage changes.
