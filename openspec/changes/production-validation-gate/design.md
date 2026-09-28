# Design: Production Validation Gate

## Approach

Create dedicated production-gate test runner that exercises existing public/runtime surfaces rather than duplicating internal unit-test logic.

Suite should be deterministic and isolated per scenario. Each scenario gets its own temporary WAM state directory and, where applicable, fresh process.

## Required scenarios

1. Happy path:
 Requirement -> hypothesis -> experiment -> tool result -> observation -> assessment -> evidence -> verified requirement -> DONE.

2. False success:
 Agent reports completion while execution contradicts expected result. WAM MUST prevent DONE.

3. Browser runtime:
 Playwright/automation dependency exists but required browser executable is missing. Result MUST be classified as runtime/dependency problem and MUST NOT be attributed to selected site strategy.

4. Inconclusive:
 Execution produces no sufficient observation. WAM MUST NOT convert this into success or unsupported failure.

5. Repetitive strategy:
 Same failing strategy is attempted repeatedly across persisted state. WAM MUST stop loop and require diagnosis/replanning.

6. Restart:
 Terminate between experiment creation, observation, assessment and evidence; restart and recover without fabricating state.

7. Idempotency:
 Replay same persisted execution/assessment event and verify no duplicate semantic evidence or lineage is created.

8. Concurrency:
 Two independent sessions/tasks MUST NOT leak active-task, cognition or evidence state into each other.

9. Redaction:
 Credentials/tokens/password-like values MUST NOT appear in persisted cognition, evidence, audit or telemetry artifacts.

10. Corruption:
 Malformed persisted records MUST produce deterministic recovery/diagnostic behavior and MUST NOT silently become valid evidence.

## Release contract

Production gate runs after:
- clean dependency installation;
- unit/invariant tests;
- smoke tests;
- package tarball verification.

Failure blocks release.

## Test implementation constraints

Prefer observable behavior and persisted state assertions over direct private-function assertions. Internal helpers may be used only where required to create controlled fixtures.

Every scenario must leave diagnostics sufficient to identify failed invariant.