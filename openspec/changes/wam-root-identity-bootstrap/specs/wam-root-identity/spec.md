# WAM Root Identity & Bootstrap

## ADDED Requirements

### Requirement: Session identity MUST NOT be a filesystem path
`setActiveSession(root, sessionID)` SHALL persist `opencode_session_id` only
when `sessionID` is a non-empty string without path separators (`/`, `\`) and
not equal to the root. Otherwise it SHALL persist `null`.
`getSessionId` SHALL keep resolving state files whose `opencode_session_id`
already contains a path.

#### Scenario: A path is passed as a session identity
- **WHEN** `setActiveSession(root, "/abs/path/to/project")` is called
- **THEN** `.wam/active_session.json` contains `opencode_session_id: null`
- **AND** the call returns a non-empty `ses_…` identity
- **AND** `opencode_session_id` never contains a path separator

#### Scenario: Legacy state with a path in the pointer
- **WHEN** `.wam/active_session.json` already has a path in
  `opencode_session_id` and a derived `session_id`
- **THEN** `getSessionId(root)` returns the stored `session_id`

### Requirement: A root's own memory MUST win over sibling continuity
`resolveWamRoot(prompt, sessionRoot)` SHALL return `sessionRoot` when
`sessionRoot/.wam` exists, after explicit prompt paths and repo-name matching.
The mtime tiebreaker SHALL apply only when `sessionRoot` is an ancestor
container without `.wam`.

#### Scenario: Non-git project with its own memory
- **WHEN** `sessionRoot` is not a git repo, owns `.wam`, and a child git repo
  has a fresher `.wam/tasks/*/context.md`
- **THEN** `resolveWamRoot("", sessionRoot)` returns `sessionRoot`

#### Scenario: Ancestor container without memory
- **WHEN** `sessionRoot` has no `.wam` and the prompt names a sibling repo
- **THEN** `resolveWamRoot` returns that sibling repo

### Requirement: The first task of a fresh root is born approved
The first task SHALL be created APPROVED when the root has no pre-existing
`.wam/tasks/*` entries and no `.wam/context/project.md`: the persisted contract
SHALL be `APPROVED` with `approvedBy: "bootstrap"` and phase `IMPLEMENTING`.
Every subsequent task SHALL be created with `phase: "PROPOSED"`, but that
state is advisory per the zero-friction policy: WAM recommends reviewing the
contract and continues, it never hard-blocks a non-bootstrap contract.

#### Scenario: First task in a brand-new project
- **WHEN** the first task is created in an empty root
- **THEN** the persisted state has `phase: "IMPLEMENTING"` and
  `contract.status: "APPROVED"`, `contract.approvedBy: "bootstrap"`

#### Scenario: Second task in the same root
- **WHEN** another task is created after a task already exists in `.wam/tasks`
- **THEN** its state stays `phase: "PROPOSED"` with an advisory recommendation
  (`/wam contract approve` is optional, not required to continue)
