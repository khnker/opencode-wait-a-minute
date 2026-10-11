# Change: Subagent-Driven Skills
## Why
Parallel agent work exists but its outputs are free-form text, so it is incompatible with
WAM's CLAIM/ACTION/OBSERVATION/EVIDENCE epistemology. A skill should be able to choose its
execution strategy, and each subagent must return structured, attributable evidence.
## What Changes
- Declare `execution.strategy`: `subagent | direct | parallel`.
- Fan out independent tasks to agents and synthesize the results.
- Every subagent MUST return CLAIM / ACTION / OBSERVATION / EVIDENCE.
- Each subagent has an explicit scope; evidence is attributable to its subagent.
- Synthesis MUST NOT convert an absence of evidence into evidence.
- Partial errors are recorded.
## Non-goals
- The workflow engine (CH-04) or composition primitives (CH-01).
- Choosing a model/router per subagent.
## Depends on
- `skill-workflow-engine` (CH-04), `skill-verification-completion` (CH-05).
## Expected Result
Subagent execution is a reusable strategy whose structured outputs satisfy the same
evidence bar as the main agent.
## Validation
- [ ] `openspec validate subagent-driven-skills --strict` passes
- [ ] Parallel fan-out produces attributed evidence
- [ ] A missing subagent result stays MISSING (never evidenced)
## Program
- Program: Superpowers integration
- Order: 6 of 7
- Priority: P1
