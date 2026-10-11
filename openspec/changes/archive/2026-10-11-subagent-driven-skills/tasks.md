# Tasks: Subagent-Driven Skills
## 1. Strategy
- [x] 1.1 Add `execution.strategy` (subagent|direct|parallel) to the skill contract
- [x] 1.2 Scope declaration per subagent
## 2. Structured outputs
- [x] 2.1 Define the subagent CLAIM/ACTION/OBSERVATION/EVIDENCE schema
- [x] 2.2 Evidence attribution by subagent id
## 3. Synthesis
- [x] 3.1 Fan-in/synthesis that preserves attribution
- [x] 3.2 Block absence->evidence promotion
- [x] 3.3 Record partial errors
## 4. Tests
- [x] 4.1 Parallel fan-out with attributed evidence
- [x] 4.2 Missing subagent result stays MISSING
- [x] 4.3 Out-of-scope output rejected
