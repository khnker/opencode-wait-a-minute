# Design: Fix WAM message attribution

## Research

- OpenCode `v1.19.0` (`anomalyco/opencode`, sha
  `733b2c627e5aec39cb33cc22373bdce33053ef2c`):
  - `packages/session-ui/src/components/message-part.tsx:1199` renders the user
    body from `parts.find(p => p.type === "text" && !p.synthetic)`. The first
    non-synthetic text part wins; later ones are ignored.
  - `packages/opencode/src/session/prompt.ts:203` treats a user message as
    "real" only when not every part is synthetic.
  - Synthetic parts stay in the transcript and reach the model; they are only
    excluded from user-identity checks and the user bubble.
- In-repo contract: `openspec/specs/chat-message-hook/spec.md` already requires
  `synthetic:true` + `metadata.wam:true` for every injected part.

## Alternatives

1. **Keep notices non-synthetic but move them after the user text.**
   Rejected: the UI still finds the first non-synthetic part; a prepended or
   appended notice still becomes part of the user's bubble, and the ordering
   hack breaks as soon as another injection path is added.
2. **Send notices through `client.session.prompt` as separate messages.**
   Rejected: creates extra turns and (in the legacy prompt endpoint) does not
   guarantee the `synthetic` flag survives; also doubles round-trips.
3. **Mark all WAM parts synthetic (chosen).** One channel, matches the spec and
   upstream semantics: hidden from the user bubble, preserved for the model.
   Exception: the reply to the `/wam` command is user-invoked, so it stays
   non-synthetic (`emitTextPart(..., { synthetic: false })`) and remains visible.

## Gate attribution

`buildCompletionValidation(gate, state)` now derives the quoted action from
`state.contract.objective` (falling back to `state.lastAction` and finally
`"continuar la tarea"`), and the line is labelled as the contract objective.
No constant can drift from what the user actually approved.

## Gate scoping

`evaluateCompletionGate` still runs on every non-trivial turn (required by
`completion-gate-adversarial`: no approval/continuation escape). Only the
*emission* of the gate hold, the LLM validation and `confirmCompletion` is
gated on `isCompletionIntent(promptText)`. A plain instruction can no longer
drag an old contract's pending list into the conversation.

## Auto-loop

The continuation directive is sent with `synthetic: true` and a `[wam auto-loop]`
prefix, so it is not rendered as a user message and cannot be confused with a
user instruction.

## Continuation classification

A continuation is recognized in one place: `isContinuationInstruction`
(`src/policy/request-classifier.js`) matches an optional acknowledgement
prefix ("listo", "ok", "dale", "vale", "perfecto") followed by a continuation
verb ("sigue", "seguí", "continúa", "continúe", "adelante", "hazlo", "procede",
"proseguí", "vamos"). The same pattern feeds `META_ONLY_RE`, so
`isMetaOnlyPrompt` returns true for these prompts and `synthesizeContract`
creates no requirements.

Alternatives rejected:

1. **Only tighten the completion regex.** Rejected: the contract would still be
   synthesized from the continuation, producing an unclosable requirement.
2. **Only treat the prompt as meta.** Rejected: `isCompletionIntent` would still
   report a claim and the gate would fire against the previous contract.
3. **Hardcode the exact live string.** Rejected: the class is ack+continuation,
   not one phrase.

## Risks

- If a future OpenCode version stops passing unknown part fields through the
  legacy prompt endpoint, the auto-loop message could become visible again.
  Mitigation: the directive is prefixed with `[wam auto-loop]` and the part is
  synthetic; a unit test pins the payload.
- Users lose chat-visible WAM notices. Mitigation: notices are still written to
  `.wam` logs and the final summary; the existing spec already declared them
  hidden. Only the reply to the user-invoked `/wam` command stays visible
  (`synthetic: false`).
- A continuation already stored as a requirement (pre-fix sessions) stays
  pending. Mitigation: close it with `/wam progress <id> verified "<juicio>"`
  or reject the contract; new sessions cannot create one.
