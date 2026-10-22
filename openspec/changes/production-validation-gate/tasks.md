# Tasks: Production Validation Gate

## 1. Gate runner
- [x] 1.1 Add dedicated production-gate test entry point.
- [x] 1.2 Ensure every scenario uses isolated temporary state.
- [x] 1.3 Make failures non-zero and diagnostics actionable.

## 2. Critical execution scenarios
- [x] 2.1 Implement happy-path lineage test.
- [x] 2.2 Implement false-success/DONE rejection test.
- [x] 2.3 Implement missing-browser-runtime test.
- [x] 2.4 Implement INCONCLUSIVE test.
- [x] 2.5 Implement repetitive-strategy loop-break test.

## 3. Persistence and isolation
- [x] 3.1 Implement restart recovery test.
- [x] 3.2 Implement crash-between-state-transitions tests.
- [x] 3.3 Implement duplicate-event/idempotency test.
- [x] 3.4 Implement concurrent-session isolation test.

## 4. Hardening scenarios
- [x] 4.1 Implement secret-redaction test.
- [x] 4.2 Implement corrupted-state behavior test.

## 5. Release integration
- [x] 5.1 Run gate against packed artifact where practical.
- [x] 5.2 Add single release-gate command that runs complete required sequence.
- [x] 5.3 Document exact production-gate command and required runtime versions.

## 6. Verification
- [x] 6.1 Run gate from clean checkout.
- [x] 6.2 Confirm every scenario fails when its invariant is intentionally broken.
- [x] 6.3 Confirm complete gate exits zero only when all scenarios pass.
