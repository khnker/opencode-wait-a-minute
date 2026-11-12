# session-dashboard Delta

## ADDED Requirements

### Requirement: No Embedded Session Dashboard Server
WAM MUST NOT start an HTTP server to expose session or task state, and MUST NOT read `WAM_DASHBOARD` or `WAM_DASHBOARD_PORT`. Session state is owned by the host.

#### Scenario: Dashboard env is ignored
- **GIVEN** `WAM_DASHBOARD=true` and `WAM_DASHBOARD_PORT` set
- **WHEN** the plugin is loaded
- **THEN** no HTTP server is created and no port is bound

#### Scenario: Host remains the session UI
- **WHEN** a user needs session information
- **THEN** they use the opencode host UI/API, not a WAM server
