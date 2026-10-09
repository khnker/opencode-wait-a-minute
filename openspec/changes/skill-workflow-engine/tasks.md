# Tasks: Workflow Engine
## 1. Definition
- [x] 1.1 Workflow YAML schema (steps + modifiers)
- [x] 1.2 Validate referenced skills against the registry
## 2. Execution
- [x] 2.1 Persistent workflow state (current/visited/retries/branches)
- [x] 2.2 Branching (`conditional`)
- [x] 2.3 Controlled retry with bounded max + fallback
- [x] 2.4 Parallel steps + synthesis
## 3. Recording
- [x] 3.1 Record executed skills per workflow (CH-01 graph)
- [x] 3.2 Ensure the final state is verifiable (CH-05)
## 4. Tests
- [x] 4.1 `debug` workflow runs end-to-end
- [x] 4.2 Retry bounded, fallback on exhaustion
- [x] 4.3 Conditional step skipped when condition is false
- [x] 4.4 Workflow resumes across sessions
