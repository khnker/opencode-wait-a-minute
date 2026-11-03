# CQE Query Robustness Specification

## ADDED Requirements

### Requirement: Catalog reflects working-tree changes

The system SHALL reconcile the CQE catalog when repository files change after
the first index build, so symbols and line numbers match the working tree.

#### Scenario: New symbol after the first build

- **WHEN** a file is edited after the catalog was built and the freshness TTL has expired
- **THEN** the next indexed query finds the new symbol at its current line

#### Scenario: Clean repository reuses the catalog

- **WHEN** `freshness()` reports no changed, added or removed files
- **THEN** `ensureIndex` reuses the catalog without rebuilding it

### Requirement: Invalid CQP degrades to intent parsing

The system SHALL fall back to intent parsing when a query looks like CQP because
of its first word but fails CQP parsing.

#### Scenario: Natural-language query starts with a CQP verb

- **WHEN** the query is `SELECT <symbol>`, `LIST files in src` or `SEARCH for <symbol>`
- **THEN** the engine returns intent results instead of throwing `FIND missing`

#### Scenario: Valid CQP keeps the CQP path

- **WHEN** the query parses as CQP (for example `FIND definitions OF symbol parseConfig`)
- **THEN** the engine executes the CQP plan and returns its results

#### Scenario: Malformed CQP does not fail the query

- **WHEN** a CQP-shaped query is missing a required clause or name
- **THEN** the engine degrades to intent parsing and returns a result object
