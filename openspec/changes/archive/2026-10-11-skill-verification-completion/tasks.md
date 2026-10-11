# Tasks: Verification Before Completion
## 1. Model
- [x] 1.1 Add CLAIMED/SUPPORTED/VERIFIED/FAILED/UNKNOWN on the completion path
- [x] 1.2 Add the `verification_method` enum
## 2. Enforcement
- [x] 2.1 Block completion tokens unless VERIFIED
- [x] 2.2 Downgrade to UNKNOWN when the method is missing
## 3. Integration
- [x] 3.1 Wire the evidence-provenance and doc-02-claims stores
- [x] 3.2 Log method + evidence id per completion claim
## 4. Tests
- [x] 4.1 Reason-only claim -> UNKNOWN (blocked)
- [x] 4.2 Automated evidence -> VERIFIED
- [x] 4.3 `human_confirmation` accepted as a method
- [x] 4.4 Contradicting observation -> FAILED
