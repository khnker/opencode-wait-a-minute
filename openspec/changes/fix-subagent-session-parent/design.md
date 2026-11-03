# Design — subagent session parent resolution

## Research

- OpenCode SDK response envelope: https://opencode.ai/docs/sdk/
- Existing WAM subagent exemptions: `governance-enforcement.js` and
  `maybeTaskLoop` both key off a resolved `parentID`.

## Alternatives

1. **Unwrap `response.data` in `resolveSessionBase` and gate `chat.message`
   (chosen).** Minimal, keeps the SDK contract intact, supports both wrapped and
   unwrapped test mocks, and prevents worker prompts from receiving WAM context.
2. Change the SDK to return unwrapped objects. Rejected: vendored dependency and
   would affect every caller.
3. Infer the parent from session events. Rejected: the event may arrive after the
   first worker prompt, so the first auto-loop pass is still unsafe.

## Decisions

- Read `directory` from the session object (`info.directory`) with the legacy
  `location.directory` fallback.
- Preserve the current `{ sessionID, path }` call shape so existing mocks and
  servers keep working.
