# Design: Hypothesis Experiment Loop

## ADDED Requirements
### Requirement: Hypothesis Lifecycle
The system MUST support hypothesis statuses: proposed → testing → supported | rejected | inconclusive; each hypothesis has a confidence (0..1); rejected hypotheses MUST be persisted to prevent silent retries.
#### Scenario: Rejected hypothesis prevents silent retry
- **WHEN** a hypothesis is marked as rejected
- **THEN** the agent does not silently retry the same hypothesis in future experiments
### Requirement: Experiment Lifecycle
Experiments MUST have statuses: proposed → running → completed | failed | aborted; each experiment MUST be linked to a hypothesis via hypothesisId; reversibility is required for autonomous execution; risk (SAFE/GUARDED/BLOCKED) is delegated to the risk engine.
#### Scenario: Experiment requires reversible action for autonomous execution
- **WHEN** an experiment is linked to an irreversible action
- **THEN** the experiment cannot be executed autonomously
### Requirement: Observation Model
Each experiment produces an observation with a result (string), facts (array), and unexpected (array); observations MUST be linked to experimentId.
#### Scenario: Observation linked to experiment
- **WHEN** an experiment completes
- **THEN** an observation is created with result, facts, and unexpected array, and linked to the experiment via experimentId
### Requirement: Replanning Triggers
Replanning MUST be triggered when: a hypothesis is rejected, an experiment fails, verification fails, or a new constraint is discovered.
#### Scenario: Verification failure triggers replanning
- **WHEN** verification of a hypothesis fails
- **THEN** replanning is triggered
### Requirement: Persistence
Hypothesis and experiment state MUST live under `.wam/tasks/<taskId>/cognition/` in JSONL format (hypotheses.jsonl, experiments.jsonl, observations.jsonl) to allow append-only compaction.
#### Scenario: State persists in JSONL files
- **WHEN** a new hypothesis is formed
- **THEN** it is appended to hypotheses.jsonl under `.wam/tasks/<taskId>/cognition/`