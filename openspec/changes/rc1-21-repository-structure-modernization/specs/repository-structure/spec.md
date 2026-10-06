# Repository Structure Modernization

## ADDED Requirements

### Requirement: Repository Structure Modernization
The repository MUST present a category-based layout (runtime, tests, benchmarks, docs, tooling) without changing behavior.

#### Scenario: Structural move preserves behavior
- **WHEN** the repository has been migrated to the category layout
- **THEN** `npm test`, `npm pack` and `npm run gate` all pass


#### Scenario: No functional drift
- **WHEN** files are relocated
- **THEN** git history shows moves only (no logic edits in moved files)

