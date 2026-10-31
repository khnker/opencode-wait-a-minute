# WAM Root Identity & Bootstrap - Proposal

## Problem Statement
A brand-new non-git project deadlocks on its first write:

1. `.wam/active_session.json` stores a filesystem path in `opencode_session_id`.
   The CPC block in `index.js` calls `ensureWamMemory(root, taskId)` although the
   function is declared as `(sessionID, promptText)`, so the root is bound as a
   session identity and a `ses_…` hash is derived from the path.
2. `resolveWamRoot` falls through to the "child git repo with the freshest
   `.wam/tasks/*/context.md`" tiebreaker whenever `sessionRoot` is not a git
   repo. A non-git project therefore inherits an unrelated sibling repo's memory.
3. With no `.wam/config.json`, `enforcement` defaults to true and a freshly
   created contract is `PROPOSED`; the first task of a new project has no human
   to approve it, so the gate blocks every write/edit.

## Proposed Solution
1. Pass the real session id to `ensureWamMemory` and read task state explicitly;
   harden `setActiveSession` with `isSessionId(value, root)` so only a
   session-id-shaped value is persisted in `opencode_session_id` (`null`
   otherwise). Legacy state files keep working through `getSessionId`.
2. In `resolveWamRoot`, return `sessionRoot` when it owns its own `.wam`
   directory, before the mtime tiebreaker. Prompt paths (rule 1) and repo
   name/path matching (rule 2) keep priority.
3. Bootstrap the first task of a root with no prior WAM memory: persist its
   contract as `APPROVED` with `approvedBy: "bootstrap"` and phase
   `IMPLEMENTING`. Every later task is created `PROPOSED` with an advisory
   recommendation (zero-friction policy): reviewing the contract is optional.

## Acceptance Criteria
- [ ] `opencode_session_id` never contains a filesystem path.
- [ ] A non-git `sessionRoot` with its own `.wam` is preferred over a sibling repo.
- [ ] The first task of a brand-new root is writable without manual approval.
- [ ] Later tasks stay `PROPOSED` and get an advisory recommendation, never a hard block.
- [ ] The bootstrap exception does not weaken enforcement for irreversible operations.

## Implementation Plan
See `tasks.md` for the ordered tasks and `design.md` for the rejected
alternatives.
