# Design: Verification Before Completion
## States
CLAIMED -> SUPPORTED (observation exists, not yet sufficient) ->
VERIFIED (evidence satisfies method) | FAILED | UNKNOWN (no method or no observation)
## Methods (exactly one, explicit)
- `automated`: a command/test whose exit/output is captured
- `observational`: a captured observation from the environment (log, file, state)
- `external_evidence`: an artifact produced outside the session, referenced by id
- `human_confirmation`: an explicit user confirmation recorded as evidence
## Rule
No completion token (DONE/COMPLETED/FIXED/VERIFIED) may be emitted unless state == VERIFIED.
Reasoning alone -> UNKNOWN.
## Integration
Reuses evidence-provenance and doc-02-claims stores; this change adds completion-time
enforcement and the explicit-method requirement.
