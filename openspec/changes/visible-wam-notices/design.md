# Design — Make user-facing WAM notices visible in opencode web

## Research

- opencode 1.19.4 web UI, user bubble:
  `packages/session-ui/src/components/message-part.tsx` (`UserMessageDisplay`)
  selects `parts.find((p) => p.type === "text" && !p.synthetic)` and renders only
  that text. A synthetic user part never reaches the DOM.
  https://github.com/anomalyco/opencode/blob/v1.19.4/packages/session-ui/src/components/message-part.tsx
- opencode 1.19.4 web UI, assistant timeline: `renderable()` and `partState()`
  treat every non-empty `text` part as visible regardless of `synthetic`.
- opencode 1.19.4 server: `session.updatePart` publishes `PartUpdated` for the
  supplied part (upsert semantics; used to create processor text parts).
  `packages/opencode/src/session/session.ts:651-659`.
- opencode 1.19.4 SDK v2: `client.session.part.update` PATCHes
  `/session/{sessionID}/message/{messageID}/part/{partID}` with the full part
  body. `packages/sdk/js/src/v2/gen/sdk.gen.ts`.
- opencode 1.19.4 plugin API: `PluginInput.client` is
  `ReturnType<typeof createOpencodeClient>` from `@opencode-ai/sdk` (v1), which
  has no part endpoints; the v2 client is used by the web app. The runtime
  prefers `client.session.part.update` and falls back to the v1 hey-api client's
  `client.session._client.patch` on the same route, then fails soft.
  https://github.com/anomalyco/opencode/blob/v1.19.4/packages/plugin/src/index.ts
  https://github.com/anomalyco/opencode/blob/v1.19.4/packages/sdk/js/src/gen/client/client.gen.ts
- opencode 1.19.4 prompt builder: a user message whose parts are all synthetic
  is not added to the model prompt (`packages/opencode/src/session/prompt.ts:203`).
- Current notice copy: `prompts/notices/task-complete.md`,
  `prompts/notices/completion-gate.md`.
- OpenSpec workflow in this repository (`AGENTS.md`): research, alternatives,
  smallest diff, regression tests, validate.

## Alternatives considered

1. **Emit the notice as a non-synthetic part on the user message.**
   The user bubble renders only the first non-synthetic text part. Prepending the
   notice hides the user's prompt; appending it hides the notice. Rejected.
2. **Merge the notice into the user's text part.** Visible, but it mutates the
   stored user prompt, contaminates copy/quote/export and violates the repository
   rule "keep user prompts immutable". Rejected.
3. **Call `client.tui.showToast`.** Works for the TUI; the web app does not
   subscribe to `tui.toast.show` (verified in the 1.19.4 web source), so it is a
   no-op for `opencode web`. Rejected.
4. **Append a synthetic text part to the assistant message after it finishes.**
   The assistant timeline renders synthetic text, prompt extraction only reads
   user parts, and `maybeAutoContinue` filters `!synthetic` so the notice cannot
   influence completion detection. Chosen.

## Decision

1. `handleMessage` enqueues the same user-facing text it already injects for the
   model: the `⛔` block directive when `gate.blocked`, the advisory
   `notice.completion_gate` when the gate is advisory, and the
   `notice.task_complete` completion notice.
2. The queue is per session, deduplicated by exact text, capped at 5 entries and
   cleared when the session is deleted.
3. When an assistant `message.updated` event reports `finish` or
   `time.completed`, the plugin drains the queue and PATCHes each text as a new
   `synthetic: true` part on that assistant message. Each part carries the usual
   WAM metadata/provenance and a fresh `prt_` id. The update goes through
   `client.session.part.update` when the host exposes the v2 client, otherwise
   through the v1 `client.session._client.patch` on the same route.
4. Failure is soft: a missing part endpoint or a rejected PATCH logs a warning
   and drops the notice; the chat turn and model context are unaffected.
5. `/wam ctx get` strips one pair of matching surrounding single or double
   quotes before retrieval. A new `src/shared/command-args.js` helper keeps the
   behavior unit-testable.

## Data flow

```
chat.message -> handleMessage -> emitTextPart (synthetic, user parts, UNCHANGED)
                              -> queueVisibleNotice(sessionID, text)

message.updated (assistant, finished)
  -> drainVisibleNotices(sessionID)
  -> client.session.part.update({ part: synthetic text part on assistant message })
  -> server publishes PartUpdated
  -> web timeline renders the notice
```

## Failure modes

- No assistant message (aborted/empty turn): the notice stays queued and flushes
  on the next assistant completion; session deletion clears it.
- Part endpoint unavailable (older host): warn once per session, drain and drop.
- Duplicate notice text: enqueued once.
- Queue growth: bounded to 5; oldest dropped first.

## Verification

- Affected suites: 34/34 pass (`test/message-handler.test.mjs`,
  `tests/unit/visible-notices.test.mjs`, `tests/unit/command-args.test.mjs`).
- `openspec validate --changes --strict`: 144/144 pass.
- `npm run build`: pass (dist includes the new modules).
- Playwright against a fresh `opencode web` (port 4801, fixture
  `/home/nicolas/wam-pw-e2e`):
  - blocked DONE rendered `[wam] ⛔ … Completitud bloqueada` in the session
    body; the API shows it on the assistant message with `synthetic: true`,
    `metadata.wam: true`, `metadata.wamPhase: "visible-notice"`;
  - allowed DONE rendered `[wam] ✅ … Tarea completada` the same way.
  The model's own reply stayed separate, and the user prompt bubble was
  unchanged.
