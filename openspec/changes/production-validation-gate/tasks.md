# Tasks: Production Validation Gate

## 1. Gate runner
- [x] 1.1 Add dedicated production-gate test entry point.
- [ ] 1.2 Ensure every scenario uses isolated temporary state.
- [x] 1.3 Make failures non-zero and diagnostics actionable.

## 2. Critical execution scenarios
- [ ] 2.1 Implement happy-path lineage test.
- [ ] 2.2 Implement false-success/DONE rejection test.
- [ ] 2.3 Implement missing-browser-runtime test.
- [ ] 2.4 Implement INCONCLUSIVE test.
- [ ] 2.5 Implement repetitive-strategy loop-break test.

## 3. Persistence and isolation
- [ ] 3.1 Implement restart recovery test.
- [ ] 3.2 Implement crash-between-state-transitions tests.
- [ ] 3.3 Implement duplicate-event/idempotency test.
- [ ] 3.4 Implement concurrent-session isolation test.

## 4. Hardening scenarios
- [ ] 4.1 Implement secret-redaction test.
- [ ] 4.2 Implement corrupted-state behavior test.

## 5. Release integration
- [ ] 5.1 Run gate against packed artifact where practical.
- [x] 5.2 Add single release-gate command that runs complete required sequence.
- [ ] 5.3 Document exact production-gate command and required runtime versions.

## 6. Verification
- [ ] 6.1 Run gate from clean checkout.
- [ ] 6.2 Confirm every scenario fails when its invariant is intentionally broken.
- [x] 6.3 Confirm complete gate exits zero only when all scenarios pass.
