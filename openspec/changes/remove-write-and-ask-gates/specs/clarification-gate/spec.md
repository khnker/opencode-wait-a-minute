# Clarification Gate Delta

## MODIFIED Requirements

### Requirement: Hard block on execution while asking

While a task is in `ASKING`, WAM SHALL block mutating tools only when the task was
parked by an unknown that explicitly carries `blocking: true`. Inferred uncertainties
MUST be `advisory` and MUST NOT park the task. When WAM does block, it MUST be enforced
in `tool.execute.before` and the directive MUST name the pending blocking question.

#### Scenario: Implementation tool blocked during explicit ASKING
- **WHEN** a task is in `ASKING` because of an unknown with `blocking: true` and the agent
  attempts a mutating tool call
- **THEN** the tool call is aborted with a directive naming the pending blocking question

#### Scenario: Inferred uncertainty does not block
- **WHEN** a task carries only `advisory` unknowns
- **THEN** write, edit and bash calls proceed normally
