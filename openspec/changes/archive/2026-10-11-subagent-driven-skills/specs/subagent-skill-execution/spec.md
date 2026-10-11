# Subagent Skill Execution
## ADDED Requirements
### Requirement: Reusable execution strategies
A skill MUST be able to declare its execution strategy: `subagent`, `direct` or `parallel`.
#### Scenario: Parallel declaration
- **WHEN** a skill declares `parallel`
- **THEN** independent tasks fan out to multiple agents and are synthesized

### Requirement: Structured subagent output
A subagent MUST return CLAIM, ACTION, OBSERVATION and EVIDENCE, not free-form text.
#### Scenario: Free-form subagent output
- **WHEN** a subagent returns prose without the structured fields
- **THEN** the output is rejected for synthesis

### Requirement: Attributed evidence and scope
Every subagent MUST have an explicit scope and every evidence item MUST be attributable to
its producing subagent.
#### Scenario: Out-of-scope work
- **WHEN** a subagent produces work outside its declared scope
- **THEN** it is rejected or ignored
#### Scenario: Evidence attribution
- **WHEN** evidence is synthesized
- **THEN** it retains the producing subagent id

### Requirement: Synthesis cannot fabricate evidence
Synthesis MUST NOT transform an absence of evidence into evidence.
#### Scenario: Missing result
- **WHEN** a subagent produced no evidence
- **THEN** the synthesis reports it as MISSING, never as evidenced

### Requirement: Partial errors recorded
A failed subagent MUST be recorded with its error so the workflow can retry or fall back.
#### Scenario: One agent fails
- **WHEN** one of several agents fails
- **THEN** the failure is recorded and the others proceed
