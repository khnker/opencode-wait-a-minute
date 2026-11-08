# Design: Fix Permission Auto-Allow On OpenCode 1.19+

## Research

- OpenCode plugin docs: <https://opencode.ai/docs/plugins/>
- OpenCode permissions docs: <https://opencode.ai/docs/permissions/>
- Installed SDK types: `@opencode-ai/sdk` v2 event union and permission client.
- Local runtime evidence: `/home/nicolas/.local/share/opencode/log/opencode.log`
  records `action.action=ask` and `message=asking` for `permission=bash`, while
  the WAM `permission.ask` hook sets `allow`.

The docs list `permission.asked` / `permission.replied` events. They do not list
a `permission.ask` hook. The SDK exposes both shapes:

- `client.permission.reply({ requestID, reply })`
- `client.session.permission.reply({ sessionID, requestID, reply })`
- `client.postSessionIdPermissionsPermissionId({ path: { id, permissionID }, body: { response } })`

## Alternatives

1. **Relax the global opencode permission config.** Rejected: it applies to every
   project and bypasses opencode's own whitelist outside WAM, not just the WAM
   session that asked for zero friction.
2. **Keep relying on `permission.ask`.** Rejected: OpenCode 1.19.4 no longer calls
   it; the log shows the ask survives the hook.
3. **Reply from the plugin `event` hook (chosen).** Uses the supported event and
   SDK APIs, keeps the policy inside WAM, and works for both v1 and v2 payloads.
4. **Run an external API watcher.** Rejected: extra process, race with the ask,
   and no access to the plugin's session maps.

## Implementation

- Add `replyPermissionRequest(client, requestID, sessionID)`.
- The live OpenCode 1.19.4 plugin client exposes the v1
  `postSessionIdPermissionsPermissionId` method, not the v2 permission client;
  the fallback chain covers both.
- On `permission.asked` or `permission.v2.asked`, read the request id from
  `properties.id` (fall back to `requestID` / `permissionID`) and reply `always`.
- Try `client.permission.reply` first, then
  `client.session.permission.reply` when a session id is available, then the
  OpenCode v1 `postSessionIdPermissionsPermissionId` method.
- Treat an SDK `{ error }` result as a failed attempt and continue to the next
  endpoint.
- Log a debug line when no endpoint succeeds; never throw from the event hook.
- Keep the legacy `permission.ask` hook unchanged for older OpenCode versions.

## Safety

The event only removes the human approval dialog. WAM's execution gate still
evaluates `tool.execute.before` and blocks reversible-policy violations such as
hard deletes. Replying `always` applies to the permission request's own patterns;
it does not add a global config rule.
