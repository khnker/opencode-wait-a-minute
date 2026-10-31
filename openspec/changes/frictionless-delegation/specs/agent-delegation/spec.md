# Spec: Agent delegation

## ADDED Requirements

### Requirement: Delegation and meta tools are frictionless

The action-risk envelope MUST NOT classify `task`, `skill`, `compress`,
`delegate_task` or `call_agent` as risky. These tools MUST bypass risk
classification and MUST NOT produce a `RISK BLOCK` directive.

#### Scenario: Delegating with Task

- **GIVEN** a `task` tool call
- **WHEN** the effective capability is resolved
- **THEN** it is `SAFE`
- **AND** the risk branch emits no block directive

#### Scenario: Loading a skill

- **GIVEN** a `skill` tool call
- **WHEN** the effective capability is resolved
- **THEN** it is `SAFE`
- **AND** the risk branch emits no block directive

### Requirement: Uncatalogued tools are advisory at the injection layer

For a tool that is not catalogued, the injection layer MUST emit a non-blocking
`Recomendación` directive and MUST allow execution to continue. Known destructive
verbs and U1 hard-delete remain blocked.

#### Scenario: Uncatalogued tool

- **GIVEN** an uncatalogued, non-delegation tool call
- **WHEN** `tool.execute.before` evaluates risk
- **THEN** it queues a `Recomendación` directive
- **AND** it does not throw and does not emit `RISK BLOCK`

#### Scenario: Hard delete

- **GIVEN** a `bash` call matching a hard-delete pattern
- **WHEN** the execution guard runs
- **THEN** the decision is `allowed: false`
- **AND** the reason is `hard delete forbidden (U1: soft-archive only)`

### Requirement: Delegation is proposed by default for pending requirements

When a contract is `APPROVED` and pending requirements exist, WAM MUST propose one
parallel `Task` delegation per visible requirement as a non-blocking default. The
proposal MUST keep inline execution allowed and MUST discourage delegating trivial
tasks.

#### Scenario: Pending independent requirements

- **GIVEN** an `APPROVED` contract with pending requirements
- **WHEN** context is assembled
- **THEN** the injection contains one `Task(parallel)` line per visible requirement
- **AND** it states that inline mutation remains allowed
- **AND** it states that trivial tasks should stay inline

### Requirement: Each subagent receives a right-sized context

The delegation directive MUST require passing only the requirement goal, the domain or
relevant files, and the acceptance criterion — never the full conversation history.

#### Scenario: Context contract

- **GIVEN** a delegated pending requirement
- **WHEN** the delegation directive is rendered
- **THEN** it specifies the minimal context contract (goal, domain/files, acceptance)
- **AND** it explicitly excludes the full conversation history
