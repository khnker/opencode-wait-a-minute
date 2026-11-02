# Tasks

## 1. Persistence

- [x] 1.1 Add `sessionTaskPath(root, sessionId)` to `src/shared/wam-paths.js`.
- [x] 1.2 Write `.wam/session-tasks/<sessionId>.json` from `writeActiveTaskId`
      when a `sessionId` is supplied.
- [x] 1.3 Pass the session id from `/wam task switch` and `resumeTask` writes.

## 2. Resolution

- [x] 2.1 Read the session sidecar before the global pointer in
      `readActiveTaskIdFresh`.
- [x] 2.2 Recover legacy sessions by scanning task directories for
      `-sess-<last8>` / `ses-<sessionId>` and choosing the newest task.
- [x] 2.3 Keep session-less callers on the global pointer and 60s TTL.

## 3. Tests

- [x] 3.1 Sidecar wins over a foreign global pointer.
- [x] 3.2 Legacy suffix scan recovers a task with no sidecar.
- [x] 3.3 Newest matching legacy task wins.
- [x] 3.4 Session-less reads keep the existing TTL behavior.

## 4. Validation

- [x] 4.1 `node --test --test-force-exit tests/unit/session-task-binding.test.mjs`
- [x] 4.2 `npx openspec validate --changes --strict`
- [x] 4.3 `npm run build` and load `dist/index.js`
