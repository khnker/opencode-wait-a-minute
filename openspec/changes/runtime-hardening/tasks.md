# Tasks: Runtime Hardening

- [x] 1. Implement L1 input sanitization in `sanitize-input.js`: paths, shell args, JSON, size budgets.
- [x] 2. Implement L2 resource guards in `resource-guards.js`: timeouts, memory caps, loop detection, concurrency caps.
- [x] 3. Implement L3 invariant monitors in `invariant-monitors.js`: scope, risk, evidence, reversibility.
- [x] 4. Implement L4 failure containment: per-task sandbox, rollback per step, graceful shutdown.
- [x] 5. Implement `hardening.yaml` config loader with permissive/standard/strict profiles.
- [x] 6. Implement hardening telemetry emitter (`.wam/hardening.log`) and dashboard surfacing.
- [x] 7. Wire guards and monitors into the tool interception layer.
- [x] 8. Add tests:
    - [x] Path traversal (`../../etc/passwd`) is blocked.
    - [x] Shell injection (`; rm -rf /`) is blocked.
    - [x] Prototype pollution payload is blocked.
    - [x] Loop detection fires after N identical tool calls.
    - [x] Out-of-scope mutation is blocked.
    - [x] BLOCKED action without authorization is rejected.
    - [x] Completion claim without verifier pass is rejected.
    - [x] Crash recovery preserves in-flight state.
    - [x] Strict mode rejects what standard accepts (e.g., short-circuit on minor drift).
- [x] 9. End-to-end test: hostile inputs across all L1 categories are blocked; resource exhaustion triggers escalation; crash mid-task recovers cleanly.