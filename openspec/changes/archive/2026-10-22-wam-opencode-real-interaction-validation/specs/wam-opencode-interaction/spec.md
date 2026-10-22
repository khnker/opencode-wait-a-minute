# Spec: WAM-OpenCode Real Interaction Validation
## ADDED Requirements
### Requirement: REQ-INT-01: Artifact Loading
The plugin MUST register its hook handlers and initialize its state handlers when OpenCode loads it from the installed artifact.
**Given** the plugin is installed as an artifact
**When** OpenCode is started with the plugin configuration
**Then** the plugin hook handlers MUST register and trigger.
#### Scenario: Plugin loads from artifact
- **WHEN** the plugin is loaded in a fresh workspace
- **THEN** it executes its registration logic and initializes its state handlers.

### Requirement: REQ-INT-02: Persistent Interaction
The plugin MUST intercept OpenCode hooks and interact with the `.wam/` state directory while a session is running.
**Given** the plugin is running in an OpenCode session
**When** user prompts or tools trigger
**Then** the plugin MUST intercept hooks and interact with the `.wam/` state directory.
#### Scenario: Round-trip verification
- **WHEN** a user prompt is processed
- **THEN** the plugin updates its active state and the model response reflects the interaction.

### Requirement: REQ-INT-03: Compatibility Enforcement
`check-compatibility.mjs` MUST validate the Node and OpenCode version requirements against the compatibility matrix.
**Given** the runtime environment
**When** `check-compatibility.mjs` is executed
**Then** it MUST validate Node and OpenCode version requirements against the compatibility matrix.
#### Scenario: Version enforcement fails-fast
- **WHEN** an incompatible Node or OpenCode version is detected
- **THEN** the process exits with a non-zero exit code.
