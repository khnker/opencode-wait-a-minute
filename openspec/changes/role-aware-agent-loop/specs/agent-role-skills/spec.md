# Agent role skills

## ADDED Requirements

### Requirement: Roles declare preferred skills

Every agent role MUST declare an ordered list of preferred skill IDs, or an empty
list when no skill applies. The configured skill IDs MUST remain visible in the
role prompt for traceability.

#### Scenario: Generic roles have procedures

- **WHEN** the prompt is built for `ANALYST`, `ARCHITECT`, `BUILDER` or `REVIEWER`
- **THEN** the role definition provides at least one preferred skill

#### Scenario: Skill names remain visible

- **WHEN** a role declares preferred skills
- **THEN** the system prompt contains the `Preferred skills:` line

### Requirement: Approved role skills are injected

The runtime MUST resolve preferred skills from the existing skill registry and
inject the content of approved skills into the role system prompt.

#### Scenario: Approved skill is injected

- **WHEN** a preferred skill exists with an approved status and non-empty content
- **THEN** its content appears in the role system prompt

#### Scenario: Missing skill is skipped

- **WHEN** a preferred skill is absent or not approved
- **THEN** the runtime records it as missing
- **AND** the role invocation proceeds with the remaining skills

#### Scenario: Prompt budget is bounded

- **WHEN** the combined skill content exceeds the configured cap
- **THEN** the loader stops adding skills before the cap is exceeded

### Requirement: Stage is visible

The runtime MUST derive a stage from task state and the latest completed role
result. The stage MUST appear in the N2 task context, role prompts and task-loop
prompts.

#### Scenario: Latest role result wins

- **WHEN** the latest agent result is `ARCHITECT`
- **THEN** the stage reports `2/4 strategy`

#### Scenario: Completion reports done

- **WHEN** the task phase is `DONE`
- **THEN** the stage reports `4/4 done`

### Requirement: Advisory contracts keep the loop moving

When contract approval is not `required`, the task loop MUST NOT emit
`WAIT_USER` solely because the contract is still `PROPOSED`.

#### Scenario: Advisory contract continues

- **WHEN** `contractApproval` is `advisory` and the contract is `PROPOSED`
- **THEN** the loop decision is not `WAIT_USER`
- **AND** the loop prompt includes the current stage

#### Scenario: Required contract still pauses

- **WHEN** `contractApproval` is `required` and the contract is `PROPOSED`
- **THEN** the existing `WAIT_USER` decision is preserved
