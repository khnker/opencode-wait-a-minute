## ADDED Requirements

### Requirement: discovery-classification
The system SHALL classify bash invocations as either "read-only discovery" (grep/rg/find/cat/head/tail/ls) or "justified" (scripts, pipes, writes, cd build).

#### Scenario: Classify read-only discovery
- **WHEN** a bash invocation is identified as read-only discovery
- **THEN** the system classifies it as read-only discovery

#### Scenario: Classify justified operation
- **WHEN** a bash invocation contains scripts, pipes, writes, or a cd into a build directory
- **THEN** the system classifies it as justified

### Requirement: discovery-nudge
The system SHALL emit an actionable nudge suggesting a dedicated tool or the context-query-engine MCP for read-only discovery.

#### Scenario: Emit nudge for read-only discovery
- **WHEN** a user executes a bash command identified as read-only discovery
- **THEN** the system suggests the corresponding specialized tool (`grep`, `glob`, `read`, or `context-query-engine` MCP) rather than blocking

### Requirement: directory-context
The system SHALL prefer `workdir` over `cd` for setting directory context.

#### Scenario: Suggest workdir over cd
- **WHEN** a bash invocation uses `cd X && ...` for setting directory context
- **THEN** the system suggests using the `workdir` parameter instead
