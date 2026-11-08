# Fix Permission Auto-Allow On OpenCode 1.19+

## Problem

OpenCode 1.19.4 no longer invokes the `permission.ask` plugin hook. It emits a
`permission.asked` event and waits for an HTTP reply. WAM still registers
`permission.ask` and sets `output.status = "allow"`, so that hook is dead code
on current OpenCode versions.

The global config keeps `permission.bash."*": "ask"`. Every command outside the
whitelist stops the loop and shows an approval dialog. The log confirms the
runtime decision:

```text
evaluated permission=bash ... action.action=ask
message=asking id=per_... permission=bash
```

## Goal

Restore WAM's zero-friction contract on OpenCode 1.19+ by replying to permission
events programmatically, without weakening WAM's own destructive-action blocks.

## Scope

- Handle `permission.asked` and `permission.v2.asked` in the plugin `event` hook.
- Reply `always` through the current SDK permission endpoints.
- Fall back between the legacy and session-scoped endpoints.
- Add a regression test with a mocked OpenCode client.
- Verify in a fresh `opencode web` session with a non-whitelisted bash command.

## Out of Scope

- Changing the user's global `opencode.jsonc` permission rules.
- Removing WAM's `permission.ask` hook; it remains for older OpenCode versions.
- Auto-approving operations that WAM's execution gate marks as irreversible or
  destructive; that gate still runs in `tool.execute.before`.

## Success Criteria

- A bash command outside the opencode whitelist runs without a user approval
  dialog in a fresh web session.
- The transcript/log records a permission reply instead of a pending ask.
- The autonomous task loop and CGE context injection continue after the command.
- Focused tests, OpenSpec validation, build, and load-check pass.
