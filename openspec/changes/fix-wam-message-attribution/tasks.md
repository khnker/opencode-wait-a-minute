# Tasks: Fix WAM message attribution

## 1. Injection provenance

- [x] 1.1 Remove the `synthetic: false` override from `emitTextPart` so every
  WAM part goes through `injectWamParts` as synthetic.
- [x] 1.2 Remove the unused `visible: true` options from `emitTextPart` call
  sites.

## 2. Completion gate attribution

- [x] 2.1 Delete `COMPLETION_GATE_REQUESTED_ACTION` and quote
  `state.contract.objective` (fallback `state.lastAction`) in
  `buildCompletionValidation`.
- [x] 2.2 Label the line as the contract objective, not a user utterance.

## 3. Completion gate scoping

- [x] 3.1 Emit the gate hold, the LLM validation and `confirmCompletion` only
  when the message is a completion claim; keep per-turn evaluation.

## 4. Auto-loop attribution

- [x] 4.1 Send the auto-loop directive with `synthetic: true` and a
  `[wam auto-loop]` prefix.

## 5. Tests and docs

- [x] 5.1 Update `tests/unit/wam-chat-visibility.test.mjs` to assert the user
  text is the only non-synthetic part.
- [x] 5.2 Update `tests/unit/completion-gate-validation.test.mjs` expectations.
- [x] 5.3 Add regressions: gate not emitted for a non-claim turn; auto-loop
  payload is synthetic.
- [x] 5.4 Update `docs/architecture/completion.md`.
- [x] 5.5 Add a regression: consecutive claims with the same pending set emit
  the gate only once (`completionGateKey`).
- [x] 5.6 Keep `/wam` command replies visible (`synthetic: false`) while every
  background notice stays synthetic.
- [x] 5.7 Make the runner tests hermetic (`WAM_TASK_STATE_PATH` override +
  throwaway dir) so the suite cannot race the live `.wam/task-state.json`.

## 6. Continuation prompts

- [x] 6.1 Add `isContinuationInstruction` in
  `src/policy/request-classifier.js` (ack prefix + continuation verb) and use
  it in `isCompletionIntent`.
- [x] 6.2 Extend `META_ONLY_RE` so `isMetaOnlyPrompt` recognizes the same forms,
  preventing requirement synthesis from a continuation.
- [x] 6.3 Regressions: "listo sigue"/"listo, continúa" are not claims, emit no
  gate, and synthesize no requirements.

## 7. Validation

- [x] 7.1 `node --test --test-force-exit` on the affected suites.
- [x] 7.2 `openspec validate --changes --strict`.
- [x] 7.3 `npm run build` and load-check `dist/`.
