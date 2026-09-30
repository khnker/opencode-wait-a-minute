# real-llm-runner Specification

## Purpose
TBD - created by archiving change real-llm-token-savings-validation. Update Purpose after archive.
## Requirements
### Requirement: Real-LLM Runner
The benchmark suite MUST include a runner capable of executing tasks against live LLM providers using WAM’s assembly pipeline.

#### Scenario: Real LLM Execution
- **WHEN** a task is executed using `wam-runner`
- **THEN** it routes through the WAM assembly pipeline
- **AND** it records token usage via the provider adapter

