# Package Surface Migration

## ADDED Requirements

### Requirement: Frozen Published Surface
Before any layout migration, the published package surface MUST be frozen via `package.json`.

#### Scenario: Surface freeze
- **WHEN** preparing for `src/` migration
- **THEN** `package.json` `files` and `main` fields MUST be explicitly defined to isolate the public API from internal structure.
- **AND** no source files MUST be moved in the initial freeze phase.
