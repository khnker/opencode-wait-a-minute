# Runtime Defaults

## ADDED Requirements

### Requirement: Logging is opt-in

WAM MUST NOT emit console or file logs by default. Logging MUST be enabled only by configuration or environment opt-in.

#### Scenario: Default silence
- **WHEN** the plugin loads without logging configuration or `WAM_LOGGING`
- **THEN** `loadWamConfig` returns `logging: false` and `wamLog`/`wamWarn`/`wamError` emit nothing

#### Scenario: Explicit opt-in
- **WHEN** `WAM_LOGGING=true` or project config `logging: true` is set
- **THEN** WAM logging is enabled

### Requirement: Sessions dashboard is opt-in

WAM MUST NOT start its sessions dashboard HTTP listener by default.

#### Scenario: Dashboard disabled
- **WHEN** `WAM_DASHBOARD` is unset or not `1`/`true`
- **THEN** no dashboard port is opened and no dashboard startup message is printed

#### Scenario: Dashboard enabled
- **WHEN** `WAM_DASHBOARD=true` or `1`
- **THEN** the dashboard listens on `WAM_DASHBOARD_PORT` or port 4321
