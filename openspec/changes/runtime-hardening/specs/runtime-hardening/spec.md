# Design: Runtime Hardening

## ADDED Requirements
### Requirement: Input Sanitization
The system MUST sanitize file paths (no traversal, no absolute paths outside repo), shell arguments (no injection, no command chaining), JSON/YAML payloads (no prototype pollution, no oversized blobs), and truncate inputs to budget caps before processing.
#### Scenario: Path traversal blocked
- **WHEN** a file path argument contains directory traversal sequences
- **THEN** the path is sanitized and the operation is blocked if it would escape the repository root
### Requirement: Resource Guards
The system MUST enforce wall-clock timeouts per tool call and per task, memory caps with backoff when exceeded, loop detection (same tool + same arguments N times → escalate), and concurrency caps (max parallel tool calls, max in-flight plans).
#### Scenario: Loop detection escalates
- **WHEN** the same tool with the same arguments is invoked N times
- **THEN** the loop is detected and escalated rather than continuing indefinitely
### Requirement: Invariant Monitors
The system MUST enforce scope invariant (no mutation outside assessment scope), risk invariant (no BLOCKED action executed without authorization), evidence invariant (completion claims pass verifier), and reversibility invariant (irreversible actions require explicit acknowledgment).
#### Scenario: BLOCKED action requires authorization
- **WHEN** a BLOCKED action is attempted without explicit authorization
- **THEN** the action is rejected and not executed
### Requirement: Failure Containment
The system MUST provide per-task sandboxing (working dir, env vars), rollback recipes per plan step, crash-safe state writes, and graceful shutdown (save in-flight state before exit).
#### Scenario: Crash-safe state writes
- **WHEN** the agent crashes during a state write
- **THEN** state files are not corrupted due to atomic write-temp+rename
### Requirement: Enforcement Model
Guards MUST run before each tool call (L1, L3); monitors MUST run continuously (L3); failure containment is automatic and irreversible for irreversible steps only with confirmation.
#### Scenario: Guards run before tool calls
- **WHEN** any tool call is invoked
- **THEN** input sanitization and invariant monitors run before the tool executes
### Requirement: Configuration
Hardening levels MUST be configurable: permissive, standard, strict (default standard); configuration per-repo via `.wam/hardening.yaml`.
#### Scenario: Strict mode blocks more actions
- **WHEN** hardening level is set to strict
- **THEN** additional guards are enabled and more actions are blocked
### Requirement: Telemetry
The system MUST emit hardening-event for each block, retry, escalation; aggregate into `.wam/hardening.log` for audit; surface in the dev dashboard.
#### Scenario: Hardening events logged
- **WHEN** an action is blocked by a guard
- **THEN** a hardening-event is emitted and recorded in .wam/hardening.log