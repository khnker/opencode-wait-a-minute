# skill-injection — delta

## ADDED Requirements
### Requirement: Session-scoped skill dedupe
A skill body already injected in the session SHALL be replaced by a one-line
reference on later turns.
#### Scenario: Second injection
- **WHEN** a selected skill id is already in `injectedSkills`
- **THEN** the pack contains `[wam N3 skill-ref] <id>` and no skill body
- **AND** the skill state is `REFERENCED` with cause `session-dedupe`

### Requirement: Minimum match score
On-demand skills SHALL be selected only when their score reaches
`minSkillScore` (default 4). Base skills bypass scoring.
#### Scenario: Weak keyword hit
- **WHEN** an on-demand skill scores 3
- **THEN** it is not selected
