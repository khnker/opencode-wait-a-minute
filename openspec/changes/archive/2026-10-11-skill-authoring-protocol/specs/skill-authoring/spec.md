# Skill Authoring
## ADDED Requirements
### Requirement: Formal authoring pipeline
Creating a skill MUST follow the pipeline
IDENTIFY -> PRESSURE SCENARIO -> BASELINE FAILURE -> MINIMAL SKILL -> GREEN ->
LOOPHOLE DISCOVERY -> REFINE -> VERIFY, and MUST produce an authoring record.
#### Scenario: Skill without authoring record
- **WHEN** a skill is registered without a baseline failure and a verification result
- **THEN** registration is rejected
#### Scenario: Baseline then improvement
- **WHEN** a skill is authored
- **THEN** the record shows the undesired baseline behavior and the desired post-skill behavior

### Requirement: Artifact taxonomy
The system MUST distinguish `skill`, `workflow`, `reference` and `constraint`, and MUST
route each candidate to the correct kind.
#### Scenario: Workflow misclassified as skill
- **WHEN** a candidate describes a composition of other skills
- **THEN** it is classified as `workflow` and handled by the workflow engine (CH-04)

### Requirement: Authoring exclusions
A skill MUST NOT be authored for a one-off solution, a mechanical rule that belongs to
validation, project-specific information, or knowledge already covered by another skill.
#### Scenario: Duplicate knowledge
- **WHEN** a new skill overlaps an existing skill above the similarity threshold
- **THEN** authoring is rejected unless an explicit merge justification is recorded
#### Scenario: Mechanical rule
- **WHEN** the candidate is a deterministic rule
- **THEN** it is routed to validation, not to the skill registry
