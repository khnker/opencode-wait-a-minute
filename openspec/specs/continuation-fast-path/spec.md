# continuation-fast-path Specification

## Purpose
TBD - created by archiving change rc1-07-continuation-fast-path. Update Purpose after archive.
## Requirements
### Requirement: Continuation Fast-Path
Continuation with valid existing context and evidence MUST take the fast-path and avoid full rediscovery. The fast-path MUST only apply to explicit continuation/implementation instructions and MUST NOT be used to bypass the completion gate or to auto-approve a contract.

#### Scenario: Fast-path avoids rebuild
- **WHEN** a task has valid context and evidence
- **THEN** continuation does not perform a full rediscovery

#### Scenario: Fast-path requires explicit continuation
- **WHEN** the prompt is not an explicit continuation instruction
- **THEN** the completion gate evaluates the task and the fast-path is not taken while checks are blocked

