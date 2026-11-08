# Verify Skill

## ADDED Requirements

### Requirement: Verification skill activation

The system SHALL provide an on-demand `verify` skill discoverable from the
bundled `skills/` directory and selectable for verification and completion
prompts.

#### Scenario: Skill is discoverable

- **WHEN** skills are discovered from the repository root
- **THEN** `verify` is present with path `skills/verify/SKILL.md`

#### Scenario: Skill is routable

- **WHEN** the prompt asks to verify a task before declaring it done
- **THEN** the `verify` skill is selected

### Requirement: Completion invariants

The verify skill and the runtime completion gate SHALL enforce, before any
completion claim:

1. valid task state (fail closed);
2. no blocking unknown or unresolved decision-critical assumption;
3. every mandatory requirement verified with non-empty evidence;
4. structured evidence that is same-session, fresh, non-contradictory, and
   strong enough for the requirement;
5. no pending backlog;
6. a satisfied completion contract and outcome contract;
7. a legal transition to `COMPLETED`.

Optional requirements MUST NOT block completion.

#### Scenario: Cross-session evidence

- **WHEN** a requirement's evidence belongs to a different session than the task
- **THEN** the gate reports the evidence as invalid and completion is not allowed

#### Scenario: Stale evidence

- **WHEN** structured evidence is marked stale or older than the configured
  maximum age
- **THEN** the gate reports it as stale and completion is not allowed

#### Scenario: Contradictory evidence

- **WHEN** a requirement has both supporting and contradicting structured evidence
- **THEN** the gate reports a contradiction and completion is not allowed

#### Scenario: Optional requirement

- **WHEN** only an optional requirement is unverified
- **THEN** completion is not blocked by that requirement

### Requirement: Skill cannot replace the gate

The verify skill SHALL NOT mark requirements verified, mutate task state, or
declare completion on its own. It MUST route the final decision through the
runtime completion gate.

#### Scenario: Skill finds pending work

- **WHEN** the runtime gate reports pending items
- **THEN** the agent reports them and does not claim DONE
