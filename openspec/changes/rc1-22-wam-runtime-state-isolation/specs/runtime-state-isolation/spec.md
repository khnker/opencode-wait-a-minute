# Runtime State Isolation (.wam)

## ADDED Requirements

### Requirement: Runtime State Isolation (.wam)
`.wam/` MUST be treated as runtime/user state; transient artifacts MUST be gitignored and excluded from the published package.

#### Scenario: Local run does not dirty the repo
- **WHEN** a task run writes `.wam/` state
- **THEN** `git status` reports no new tracked changes


#### Scenario: Runtime state never ships
- **WHEN** the package is packed
- **THEN** the tarball contains no `.wam/` runtime artifacts

