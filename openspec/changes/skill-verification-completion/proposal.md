# Change: Verification Before Completion
## Why
The agent can emit DONE/COMPLETED/FIXED/VERIFIED because its reasoning ended, not because
a verification action was observed. WAM already models claims/evidence (doc-02-claims,
evidence-provenance) but does not enforce a verification method at completion time.
## What Changes
- Enforce CLAIM -> VERIFICATION ACTION -> OBSERVATION -> EVIDENCE -> VERIFIED at runtime.
- Distinguish states CLAIMED / SUPPORTED / VERIFIED / FAILED / UNKNOWN.
- Require an explicit `verification_method`: automated | observational | external_evidence | human_confirmation.
- Block completion tokens with no explicit verification method.
- Downgrade reason-only claims to UNKNOWN.
## Non-goals
- Re-defining the claim/evidence model (doc-02-claims, evidence-provenance).
- Deciding which tests to run per project.
## Depends on
- `doc-02-claims` (existing): claim evidence traceability, evidence status model.
- `add-verifiable-task-completion` (existing): completion gate.
- `skill-lifecycle-composition` (CH-01).
## Expected Result
A completion claim without a verification action and evidence is downgraded to UNKNOWN and
blocked from being reported as VERIFIED. Not every task needs an automated test, but every
completion claim needs an explicit method.
## Validation
- [ ] `openspec validate skill-verification-completion --strict` passes
- [ ] Reason-only completion is blocked (UNKNOWN)
- [ ] A method-specific completion reaches VERIFIED
## Program
- Program: Superpowers integration
- Order: 4 of 7
- Priority: P0
