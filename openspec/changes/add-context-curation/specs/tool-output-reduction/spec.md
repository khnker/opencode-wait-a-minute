# Spec: Tool output reduction

## ADDED Requirements

### Requirement: Large tool outputs are reduced

The system MUST store tool outputs above 2000 characters and replace them with a bounded summary plus a raw reference.

#### Scenario: Large output

- **GIVEN** a completed tool output of 20,000 characters
- **WHEN** `tool.execute.after` runs
- **THEN** the raw output is stored under `.wam/tool-output/`
- **AND** `output.output` contains a summary of at most 2000 characters

#### Scenario: Small output

- **GIVEN** a completed tool output of 500 characters
- **WHEN** `tool.execute.after` runs
- **THEN** `output.output` is unchanged
