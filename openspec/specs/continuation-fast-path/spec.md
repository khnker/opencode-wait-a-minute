# continuation-fast-path Specification

## Purpose
TBD - created by archiving change rc1-07-continuation-fast-path. Update Purpose after archive.
## Requirements
### Requirement: Continuation Fast-Path
Continuation with valid existing context and evidence MUST take the fast-path and avoid full rediscovery.

#### Scenario: Fast-path avoids rebuild
- **WHEN** a task has valid context and evidence
- **THEN** continuation does not perform a full rediscovery

