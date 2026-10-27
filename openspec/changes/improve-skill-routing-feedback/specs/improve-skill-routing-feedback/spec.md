# Spec: Skill routing feedback

## ADDED Requirements

### Requirement: Skill routing uses IDF and outcomes

Skill scoring MUST penalize ubiquitous keywords, deduplicate capabilities and use prior outcomes as a small signal.

#### Scenario: Ubiquitous keyword
- **GIVEN** a keyword present in more than 30% of skills
- **WHEN** skills are routed
- **THEN** that keyword contributes less than a rare keyword

#### Scenario: Outcome feedback
- **GIVEN** a skill that succeeded in the last three similar tasks
- **WHEN** the same task type is routed
- **THEN** that skill receives a positive outcome bonus
