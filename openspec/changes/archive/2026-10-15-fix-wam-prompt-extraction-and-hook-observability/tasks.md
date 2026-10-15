## 1. Prompt Extraction Hardening
- [x] 1.1 Update extractPrompt to check output parts and input parts safely
- [x] 1.2 Verify non-synthetic filtering prevents re-entrancy

## 2. Session Ownership in Task Resolution
- [x] 2.1 Pass sessionId and projectRoot options to readActiveTaskIdFresh in effectiveTaskId
- [x] 2.2 Add unit tests for session-bound active task lookup

## 3. Validation & Testing
- [x] 3.1 Run test suite and verify all tests pass
