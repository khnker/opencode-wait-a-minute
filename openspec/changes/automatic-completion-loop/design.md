# Design: automatic-completion-loop

## Research

- OpenCode plugin events expose `session.idle` with `properties.sessionID`
  (`@opencode-ai/sdk` `EventSessionIdle`), and the plugin input carries a
  `client` with `session.messages()` / `session.prompt()`.
- `session.prompt` accepts a body `{ parts: [{ type: "text", text }] }` and a
  `path.id`, i.e. it can submit a synthetic user turn to an existing session.
- The existing gate already has the rejection payload
  (`buildCompletionValidation`) and pure decision code in
  `src/integration/orchestration.js`.

## Alternatives

1. **Keep the manual instruction (status quo).** Rejected: requires a human to
   send "Listo, continúa" after every rejected DONE.
2. **Re-drive on every `session.idle` while the gate is blocked.** Rejected:
   sessions legitimately idle while waiting for a user decision, asking a
   question, or blocked on an ambiguity; re-driving would hijack those turns.
3. **Re-drive only when the assistant's last message claims completion
   (chosen).** Matches the requested semantics ("after the DONE review"), keeps
   normal idle turns untouched.
4. **Infinite loop until the gate opens (user's literal wording).** Rejected as
   the sole rule: a permanently stuck gate would burn tokens forever. Kept the
   spirit with a progress-aware budget: the per-signature counter resets when the
   pending set changes (real progress) and a total cap stops a no-progress loop.

## Approach

New pure module `src/execution/auto-continuation.js`:

- `pendingSignature(gate)` — stable string of the pending set.
- `isCompletionClaim(text)` — tail-of-message completion-intent check, reusing
  `isCompletionIntent` from orchestration.
- `planAutoContinuation({ state, gate, assistantText, messageID, cap, maxTotal })`
  — returns `{ continue, reason, nextAutoLoop, prompt }` and never mutates input.

State stored on the task: `state.autoLoop = { signature, attempts, total,
lastMessageID, exhausted }`.

Adapter (`index.js` `session.idle`):

1. Skip bypassed / subagent sessions.
2. Resolve task + root from the session caches written by `chat.message`.
3. Skip if no task, phase `DONE`, or config `autoLoop` disabled.
4. Evaluate the completion gate; stop when not blocked.
5. Read the last assistant message (`client.session.messages`), take its
   non-synthetic text parts.
6. Plan the continuation; persist `state.autoLoop`; send the prompt fire-and-forget
   with an in-flight guard per session.

Fail-open: any error (missing client, API failure, corrupt state) logs at debug
level and leaves the session untouched.

## Risks

- `session.prompt` blocks until the assistant turn completes; the handler fires
  it without awaiting so the event loop is not held.
- A completion-claim false positive could auto-drive a waiting session; bounded
  by the caps and by inspecting only the last assistant message.
- Loop counters live in task state; if another writer replaces the state object
  the counters reset. The total cap still applies within a persisted generation.
