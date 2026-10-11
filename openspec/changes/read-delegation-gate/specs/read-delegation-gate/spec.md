## ADDED Requirements

### Requirement: Main-Session Read Delegation
The plugin MUST prevent the main session from executing read-only exploration tools
(`read`, `grep`, `glob`, `list`) and MUST direct it to delegate that work to the `@fast`
subagent. The gate MUST be model-agnostic: it MUST key on main-vs-subagent session
identity, never on a model id.

#### Scenario: Main session attempts an inline read
- **WHEN** the main session (not a subagent) calls a gated tool while the gate is `enforce`
- **THEN** the call is rejected with a `WamPolicyBlock`
- **AND** the message instructs delegation via `Task(subagent_type="fast")`

#### Scenario: Subagent reads are never gated
- **WHEN** a subagent session calls a gated tool
- **THEN** the call proceeds normally (no gate, no recursion)

### Requirement: Non-Breaking Default
The gate MUST default to `warn` so existing flows keep working; `enforce` is opt-in.

#### Scenario: Warn mode
- **WHEN** the main session calls a gated tool while the gate is `warn`
- **THEN** the call proceeds and a warning is emitted instead of a block

### Requirement: Fail-Open
Any error while evaluating or applying the gate MUST NOT break the underlying tool call.

#### Scenario: Gate evaluation error
- **WHEN** the gate encounters an unexpected error
- **THEN** the tool call proceeds as if the gate were absent
