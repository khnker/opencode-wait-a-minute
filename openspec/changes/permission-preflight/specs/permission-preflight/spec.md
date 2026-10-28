# Permission Preflight

## ADDED Requirements

### Requirement: Permission preflight before delegation
WAM MUST derive the access permissions required by an approved task and block main-session `task` delegation until the whole plan is granted.

#### Scenario: Pending plan blocks delegation
- **WHEN** an approved task has a pending permission plan with at least one required type
- **THEN** `tool.execute.before` throws `WamPolicyBlock` for a `task` call from the main session with reason `permission-preflight-pending`

#### Scenario: Grant unblocks delegation
- **WHEN** the user approves the plan via `/wam permissions approve`
- **THEN** the plan status becomes `granted` and subsequent `task` delegation is not blocked

#### Scenario: Subagents are never gated
- **WHEN** a subagent session calls `task`
- **THEN** the permission preflight does not block it

### Requirement: Explicit permission decisions
The `permission.ask` hook MUST auto-allow only permission types explicitly listed in the granted plan and leave every other request as `ask`.

#### Scenario: Granted type is allowed
- **WHEN** the plan is granted with `edit` and `permission.ask` receives `{ type: "edit" }`
- **THEN** `output.status` becomes `allow`

#### Scenario: Ungranted type stays ask
- **WHEN** the plan is granted with `edit` and `permission.ask` receives `{ type: "bash" }`
- **THEN** `output.status` stays `ask`

### Requirement: Deterministic plan derivation
Plan derivation MUST be side-effect free, deduplicated by type and ordered by `PERMISSION_TYPES`.

#### Scenario: Rules combine without duplicates
- **WHEN** the task text mentions tests, an URL and `/tmp`
- **THEN** the plan contains `edit`, `bash`, `webfetch` and `external_directory` once each in that order

#### Scenario: No plan without an approved contract
- **WHEN** the contract is missing or not `APPROVED`
- **THEN** `ensurePermissionPlan` returns `null` and does not mutate state
