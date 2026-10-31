# WAM Root Identity & Bootstrap - Design

## Purpose
Keep one root's WAM memory bound to one root, never to a path-shaped "session
id", and let the first task of a fresh root run without a human approval loop
that cannot exist yet.

## Context (evidence)
- `index.js` `ensureWamMemory(sessionID, promptText)` resolves a root from its
  first argument and calls `setActiveSession(root, sessionID)`.
- The CPC block called it as `ensureWamMemory(root, taskId)` and then read
  `state.phase` from its return value (the root string). Both the identity and
  the injection guard were wrong.
- `src/context/context.js` `resolveWamRoot` tiebreaker was written for an
  ancestor container, but it also ran for a non-git leaf project.
- `buildPersistedState` always creates fresh state with phase `PROPOSED`.

## Research
- OpenCode plugin hook contract (`sessionID` is the only stable session
  identity): https://opencode.ai/docs/plugins/
- Node `fs.statSync` mtime semantics used by the continuity tiebreaker:
  https://nodejs.org/api/fs.html#fsstatSync
- In-repo precedent for path-vs-identity validation:
  `src/context/path-validator.js`, `src/policy/governance-enforcement.js`.

## Decisions

### 1. Validate the pointer, keep the derived id
`isSessionId(value, root)` accepts a non-empty string with no `/` or `\` and
different from the root. `setActiveSession` writes `null` when it fails but
still returns `getSessionId(base, sessionID)`, so the derived identity is
unchanged for callers. `getSessionId` already hashes non-safe values
(`sessionIdFromOpenCode`), so legacy files that contain a path keep resolving
to the same `ses_…` id.

Call site: `ensure` is invoked with `(sid, "")` and the task state is read with
`getTaskState(taskId, root)`. Passing the task id as prompt text let
`resolveWamRoot` term-match sibling repo names, which is exactly the leak F2
closes.

### 2. Own `.wam` beats the continuity tiebreaker
```js
if (best === sessionRoot && fileExists(path.join(sessionRoot, ".wam"))) return sessionRoot;
```
placed after rules 1–2 and before the mtime scan. A session whose root already
has WAM memory is never injected with a sibling's context; an ancestor
container without `.wam` still gets continuity.

### 3. Bootstrap only the first task of a root
`isBootstrapRoot(root, taskId)` is true when `.wam/context/project.md` is absent
and `.wam/tasks` has no directory other than the current task. In that case
`applyBootstrapApproval` sets `phase: "IMPLEMENTING"` and
`contract.status: "APPROVED"`, `contract.approvedBy: "bootstrap"`.
`buildPersistedState` applies it right before persisting. The zero-requirement
early return still runs first (an empty contract stays untracked/fail-open).

## Alternatives rejected
- **Default `enforcement` to false.** Turns the gate off for every project,
  including established ones with real approved contracts. The bootstrap is a
  one-task local exception; the global default stays closed.
- **Fail open for every non-git root.** A non-git project can still hold
  approved contracts in memory; disabling the gate based on `.git` absence
  would silently drop it for legitimate repos-in-a-container users.
- **Clear `active-task` on session start.** Hides the stale pointer that F1
  produces but does not stop writing a path as a session id; the corruption
  would reappear on the next bind and the new session would still be gate-less
  by accident rather than by design.
- **Auto-approve any contract with `status: "PROPOSED"` after N seconds.**
  Time-based approval is not review; it reopens the same deadlock for slow
  sessions and hides misconfiguration.

## Risks
- Bootstrap is inferred from the root's own artifacts; a root whose `.wam` was
  deleted intentionally will bootstrap again. That is the intended recovery
  path, documented in the spec scenario.
- `resolveWamRoot` still caches scans per session root (`repoScanCache`);
  tests must call `clearRepoCache()` between layouts.
