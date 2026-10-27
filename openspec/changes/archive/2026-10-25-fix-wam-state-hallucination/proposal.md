# Proposal: Fix WAM State Hallucination and Premature Verification

## Why
When users interact with WAM, the prompt injection and orchestration state machine sometimes hallucinate that execution is complete and run tests without actual user implementation. This causes false positives and friction.

## What Changes
- Adjust `message-handler.js` and `orchestration.js` to ensure verification and test execution are strictly gated by actual implementation steps rather than auto-inferred completion signals when requirements are pending.
- Ensure state machine requires explicit execution proof before transitioning from PROPOSED/IMPLEMENTING to VERIFYING.
