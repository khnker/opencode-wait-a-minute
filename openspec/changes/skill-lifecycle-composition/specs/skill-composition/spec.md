# Skill Composition
## ADDED Requirements
### Requirement: Skill input/output contract
A skill MUST declare the artifact kinds it consumes and produces, and every produced
output MUST carry an observation identifier.
#### Scenario: Hand-off by artifact id
- **WHEN** skill A produces output X and skill B consumes X
- **THEN** B receives X by artifact id, not by prompt text
#### Scenario: Undeclared output
- **WHEN** a skill produces an artifact kind it did not declare
- **THEN** the transition is rejected

### Requirement: Declared skill dependencies
A skill MUST be able to declare `required`, `optional` and `fallback` skills. Required
dependencies MUST be satisfied before the skill runs; optional ones MUST NOT block.
#### Scenario: Required dependency missing
- **WHEN** a skill with a required dependency runs before that dependency produced its output
- **THEN** activation fails with an explicit missing-dependency error
#### Scenario: Optional dependency missing
- **WHEN** an optional dependency did not run
- **THEN** the skill still runs and the absence is recorded

### Requirement: Skill graph is acyclic and recorded
The runtime MUST build a directed graph from declared dependencies, reject cycles, and
record the executed-skill graph for the task.
#### Scenario: Cycle rejected
- **WHEN** declared dependencies form a cycle
- **THEN** activation is rejected before any skill runs
#### Scenario: Graph recorded
- **WHEN** a task completes
- **THEN** the executed-skill graph (nodes, edges, statuses) is persisted

### Requirement: No implicit text-based dependencies
Skill activation MUST NOT depend solely on the prompt text.
#### Scenario: Prompt names a non-dependency skill
- **WHEN** the prompt mentions a skill that is not a declared dependency
- **THEN** it is not activated as a dependency
