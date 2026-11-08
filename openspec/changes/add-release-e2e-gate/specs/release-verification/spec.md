# Release Verification Capability

## ADDED Requirements

### Requirement: Release is gated on the installed package

A release MUST be blocked until the packed tarball is installed into an isolated
test user and a new `opencode web` instance loads only that installed package.

#### Scenario: Release condition passes
- **WHEN** `npm run build`, `npm run verify:release` and `npm run gate` pass on
  the exact code being released
- **THEN** the release may proceed

#### Scenario: Release condition fails
- **WHEN** any release condition fails
- **THEN** no tag, push or publish is performed

### Requirement: The test user is isolated

The release E2E MUST use a throwaway HOME and XDG directories and MUST NOT copy
the developer's real opencode configuration, credentials or caches.

#### Scenario: No real credentials are used
- **WHEN** the release E2E starts the web server
- **THEN** the server's HOME/XDG point at the throwaway test user

### Requirement: The real UI is driven

The release E2E MUST open the fixture project in the web UI, create a session,
submit a prompt through the prompt editor and assert that a plain fragment of
the assistant response is rendered in the page.

#### Scenario: Assistant response is rendered
- **WHEN** the prompt is submitted through Playwright
- **THEN** the assistant text is present in the rendered body

### Requirement: Installed plugin state is verified

The release E2E MUST verify that the installed plugin loaded, that a
`.wam/tasks/*/task.json` was created and that its contract is not `REJECTED`.

#### Scenario: Installed plugin produces task state
- **WHEN** the assistant responds
- **THEN** the marker file exists and the task contract is not `REJECTED`

### Requirement: The gate is reproducible

The release E2E MUST choose a free port, kill its server process group, write
`report.json` and `report.md`, and exit non-zero on any required-check failure.
It MUST be part of `npm run gate` outside GitHub Actions.

#### Scenario: Gate includes the release E2E
- **WHEN** `npm run gate` runs locally
- **THEN** the release E2E is executed as a required gate

### Requirement: Test discovery ignores hidden directories

The test runner MUST NOT discover suites inside hidden directories, so stale
build backups such as `.dist-root-old/` cannot break the release gate.

#### Scenario: Hidden backup dir is skipped
- **WHEN** `collectTests` walks the repository
- **THEN** it does not return files under a directory whose name starts with `.`
