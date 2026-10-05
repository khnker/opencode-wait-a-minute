# release-documentation-consistency Specification

## Purpose
TBD - created by archiving change rc1-release-engineering. Update Purpose after archive.
## Requirements
### Requirement: Removal of Stale Script References
Documentation and previous change logs MUST NOT reference deleted release scripts.

#### Scenario: Doc drift cleanup
- **WHEN** auditing `openspec/changes/harden-production-release-gate/`
- **THEN** all references to `scripts/production-gate.mjs` MUST be removed or updated to the current gate implementation.

