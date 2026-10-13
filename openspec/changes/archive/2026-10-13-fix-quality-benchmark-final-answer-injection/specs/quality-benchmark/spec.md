## ADDED Requirements

### Requirement: Fair final-answer injection
Every quality run SHALL append the identical `ANSWER_INSTRUCTION` to the last
user message of BOTH arms (baseline and WAM) before the provider is called, so
the comparison stays fair and each arm is scored under the same contract. The
append MUST be pure (the original messages are not mutated) and MUST be
deterministic and offline.

#### Scenario: instruction reaches both arms (QB-INJECT-01)
- **GIVEN** a quality run over a scenario with at least one turn
- **WHEN** `runQualitySuite` drives both arms
- **THEN** every provider request — baseline and WAM — carries
  `ANSWER_INSTRUCTION` appended to its last user message

#### Scenario: only the last user message is modified (QB-INJECT-02)
- **GIVEN** a message list with several user/assistant turns
- **WHEN** `appendFinalAnswerInstruction` runs
- **THEN** only the last user message gains the instruction, earlier messages
  are unchanged, and the input list is not mutated

#### Scenario: no accidental `-1` skip (QB-INJECT-03)
- **GIVEN** a message list whose last element is a user message
- **WHEN** the last-user index is computed
- **THEN** it resolves to a valid index (never `-1`), so the instruction is
  actually applied rather than silently skipped
