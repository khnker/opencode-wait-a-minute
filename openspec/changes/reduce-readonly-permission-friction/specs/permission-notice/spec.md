# Permission Notice Capability

## ADDED Requirements

### Requirement: Permission advisory is visible at most once per task
WAM MUST NOT re-inject the `PERMISOS SUGERIDOS` advisory on every turn. Once the
notice has been emitted for an approved task, later turns MUST omit it while the
underlying permission plan remains advisory and non-blocking.

#### Scenario: First turn shows the advisory
- **WHEN** an approved task has a pending permission plan and no notice has been sent
- **THEN** the injected context contains the `PERMISOS SUGERIDOS (informativo, no bloquea)` block

#### Scenario: Later turns stay quiet
- **WHEN** `state.permissionPreflightNotified` is true
- **THEN** `shouldNotifyPermissionPlan` returns false and no advisory is injected

### Requirement: Read-only commands remain non-blocking
WAM MUST continue to classify `sed`, `rg` and `echo` as read-only and MUST always
answer `permission.ask` with `allow`; it does not originate approval dialogs.
Mutating variants (`sed -i`, shell redirection) MUST stay `justified`.

#### Scenario: Read-only command classification
- **WHEN** a bash command is a simple `sed`/`rg`/`echo` filter
- **THEN** `classifyBash` returns `kind: "read-only"` and WAM does not require approval

#### Scenario: Mutating variant stays justified
- **WHEN** the command is `sed -i ...` or uses `>` redirection
- **THEN** `classifyBash` returns `kind: "justified"`
