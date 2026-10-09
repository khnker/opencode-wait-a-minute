# Skill Workflows
## ADDED Requirements
### Requirement: Skill and workflow are distinct
The system MUST distinguish an atomic skill from a workflow that composes skills.
#### Scenario: Workflow references skills
- **WHEN** a workflow is defined
- **THEN** every step references a registered skill

### Requirement: Declarative workflow with modifiers
A workflow MUST be declarative and MUST support `required`, `optional`, `conditional`,
`parallel`, `retry` and `fallback` step modifiers.
#### Scenario: Conditional step
- **WHEN** a step has a condition that is false
- **THEN** the step is skipped and recorded as skipped
#### Scenario: Optional step
- **WHEN** an optional step cannot run
- **THEN** the workflow continues

### Requirement: Persistent, branching, bounded workflow state
Workflow state MUST persist across sessions, support branching, and bound retries so no
step loops indefinitely.
#### Scenario: Retry exhausted
- **WHEN** a step exceeds its max retries
- **THEN** its fallback runs or the workflow fails explicitly
#### Scenario: Resume
- **WHEN** a session restarts mid-workflow
- **THEN** the workflow resumes at the persisted step

### Requirement: Verifiable termination
Every workflow MUST end in a verifiable state.
#### Scenario: Workflow completion
- **WHEN** the last step completes
- **THEN** a verification step (CH-05) produces evidence before the workflow is VERIFIED

### Requirement: No universal mandatory workflow
The system MUST NOT force any workflow on every task; workflows are opt-in.
#### Scenario: Ad-hoc task
- **WHEN** a task selects no workflow
- **THEN** execution proceeds without one
