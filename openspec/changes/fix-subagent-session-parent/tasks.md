# Tasks — subagent session parent resolution

## 1. Implementation

- [x] 1.1 Unwrap `client.session.get` as `response.data ?? response`.
- [x] 1.2 Read `directory` and `parentID` from the unwrapped session.
- [x] 1.3 Keep the resolved parent cached for `maybeTaskLoop` and
      `isSubagentSession`.
- [x] 1.4 Resolve the parent before `chat.message` injects anything and return
      early for worker sessions.

## 2. Tests

- [x] 2.1 Mock a wrapped `{ data: { directory, parentID } }` response.
- [x] 2.2 A subagent session remains allowed to mutate without WAM auto-loop.
- [x] 2.3 A subagent session receives no WAM parts or system context.

## 3. Validation

- [x] 3.1 `node --test --test-force-exit tests/unit/plugin-load.test.mjs`
- [x] 3.2 `openspec validate --changes --strict`
- [x] 3.3 `npm run build` and load `dist/index.js`
