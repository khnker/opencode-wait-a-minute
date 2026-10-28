# retention-policy Specification

## Purpose
TBD - created by archiving change add-retention-policy. Update Purpose after archive.
## Requirements
### Requirement: Dependency-aware retention planning

The system SHALL compute a deterministic retention plan for context items that
respects item relations, without mutating inputs or writing to disk.

#### Scenario: Active and durable items are retained

- **WHEN** an item has retention `active` or `durable`
- **THEN** the planner places it in `keep`

#### Scenario: Archivable items are archived, never discarded

- **WHEN** an item has retention `archivable` and no active or durable item references it
- **THEN** the planner places it in `archive` and preserves its `sourceRefs` for recovery

#### Scenario: Referenced archivable item is kept

- **WHEN** an `archivable` item is referenced by an `active` or `durable` item
- **THEN** the planner places it in `keep`

#### Scenario: Unreferenced ephemeral item is discarded

- **WHEN** an `ephemeral` item is not referenced by a live item and `canDiscard` allows it
- **THEN** the planner places it in `discard`

#### Scenario: Ephemeral item referenced by a live item is blocked

- **WHEN** an `ephemeral` item is referenced by an `active` or `durable` item
- **THEN** the planner keeps it and records a `blocked` entry with a concrete reason

### Requirement: Evidence supporting a live claim is protected

The system SHALL NOT discard the sole evidence item supporting a live claim.

#### Scenario: Sole evidence blocks discard

- **WHEN** an `EVIDENCE` item is the only evidence supporting a `CLAIM` or `REQUIREMENT` whose status is neither `invalidated` nor `superseded`
- **THEN** the planner keeps the evidence and records it in `blocked` as the sole justification for that claim

#### Scenario: Equivalent evidence frees the item

- **WHEN** another evidence item supports the same live claim
- **THEN** the first evidence item may be archived or discarded according to its retention policy

#### Scenario: Dead claim frees its evidence

- **WHEN** the supported claim is `invalidated` or `superseded`
- **THEN** its evidence is no longer treated as a sole justification

### Requirement: Plans are pure and deterministic

The system SHALL return plan arrays sorted by id and SHALL NOT mutate the input
items.

#### Scenario: Input order does not change the plan

- **WHEN** the same items are planned in a different order
- **THEN** the resulting `keep`, `archive`, `discard` and `blocked` outputs are identical

#### Scenario: Dangling relations are tolerated

- **WHEN** an item references a missing target or has a malformed relation
- **THEN** planning completes without throwing and the malformed relation is ignored

