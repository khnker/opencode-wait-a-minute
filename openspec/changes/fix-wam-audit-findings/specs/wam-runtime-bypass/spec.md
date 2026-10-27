# Specs: Fix WAM Runtime Bypass

## ADDED Requirements

### Requirement: WAM Off Bypasses Chat Message
The system MUST bypass WAM processing when `/wam off` command is active during chat.message hook execution.

#### Scenario: WAM Off Bypasses Chat Message
- **GIVEN** user sends `/wam off` command
- **WHEN** chat.message hook is invoked
- **THEN** bypass is active (execution proceeds without WAM processing)

### Requirement: WAM Off Bypasses Tool Execution Before
The system MUST bypass WAM processing when `/wam off` command is active during tool.execute.before hook execution.

#### Scenario: WAM Off Bypasses Tool Execution Before
- **GIVEN** user sends `/wam off` command
- **WHEN** tool.execute.before hook is invoked
- **THEN** bypass is active (execution proceeds without WAM processing)

### Requirement: WAM Off Bypasses Post Tool Execution
The system MUST bypass WAM processing when `/wam off` command is active during postToolExecution hook execution.

#### Scenario: WAM Off Bypasses Post Tool Execution
- **GIVEN** user sends `/wam off` command
- **WHEN** postToolExecution hook is invoked
- **THEN** bypass is active (execution proceeds without WAM processing)

### Requirement: WAM On Restores Bypass Protection
The system MUST restore WAM processing when `/wam on` command is active during chat.message hook execution.

#### Scenario: WAM On Restores Bypass Protection
- **GIVEN** user sends `/wam on` command
- **WHEN** chat.message hook is invoked
- **THEN** bypass is restored (execution requires WAM processing)