# Spec: Autonomous execution loop — evidence-driven stop guidance

## ADDED Requirements

### Requirement: Stop guidance names evidence, not a resume command

The system MUST name the missing evidence or correction as the way to continue
when the loop stops (`STOP_STAGNATION`, budget or other stop decisions), and MUST
NOT reference a `/wam resume` command.

#### Scenario: Loop stops
- **GIVEN** the loop decides a stop decision
- **WHEN** the host emits the synthetic stop prompt
- **THEN** the prompt names new evidence or a correction as the way to continue
- **AND** the prompt does not mention a resume command
