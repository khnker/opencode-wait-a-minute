# Spec: Canonical delta model

## ADDED Requirements

### Requirement: Canonical base is pinned and versioned

The system MUST persist a canonical base snapshot with an integer `version` and
a `previousVersion` field. When no snapshot exists, the base MUST be seeded at
version `0` from the current CPC memo and pinned; later memo edits MUST NOT
silently change the base.

#### Scenario: Base is seeded once

- **GIVEN** no `.wam/canonical/base.json`
- **WHEN** `loadBase` runs
- **THEN** it returns version `0` entries parsed from the CPC memo
- **AND** it persists that snapshot

#### Scenario: Memo edits do not mutate the pinned base

- **GIVEN** a pinned base snapshot
- **WHEN** the CPC memo changes
- **THEN** `loadBase` returns the pinned entries unchanged

### Requirement: Proposals never mutate the canonical base

`proposeDelta` MUST persist a proposal with `status:"proposed"`,
`baseVersion`, `reason`, `sourceRefs` and `ops`, and MUST leave the base
snapshot byte-for-byte equivalent.

#### Scenario: Propose stages without writing the base

- **GIVEN** a base at version `0`
- **WHEN** `proposeDelta` runs with an `add` op
- **THEN** the proposal is persisted as `proposed`
- **AND** the base is still at version `0` with the same entries

### Requirement: Validation gates every acceptance

`validateDelta` MUST return `{ ok, errors }` without throwing and MUST reject:
a missing proposal, a non-`proposed` status, a `baseVersion` mismatch, an
unknown op, a missing or inactive target entry, an invalid entry kind, and
session-contaminated entries detected by the existing CPC validator.

#### Scenario: Stale baseVersion is rejected

- **GIVEN** a proposal created against version `0`
- **AND** a base already accepted to version `1`
- **WHEN** `acceptDelta` runs
- **THEN** it returns `ok:false`
- **AND** the base remains at version `1`

#### Scenario: Invalid target is rejected without writes

- **GIVEN** an `invalidate` op targeting an already invalidated entry
- **WHEN** `validateDelta` runs
- **THEN** `ok` is `false`
- **AND** errors name the inactive entry
- **AND** no file is written

### Requirement: Accept applies all-or-nothing to a new version

`acceptDelta` MUST re-read the base immediately before applying, MUST write no
files when validation fails, and on success MUST write a new base with
`version` incremented by one, `previousVersion` set to the old version, and the
proposal marked `accepted`. Accepting an already accepted proposal MUST fail
safely with no further version bump.

#### Scenario: Accept bumps the version

- **GIVEN** a valid proposal against version `0`
- **WHEN** `acceptDelta` runs
- **THEN** the base becomes version `1`
- **AND** `previousVersion` is `0`
- **AND** the proposal status is `accepted`

#### Scenario: Replayed accept is rejected

- **GIVEN** an accepted proposal
- **WHEN** `acceptDelta` runs again
- **THEN** it returns `ok:false`
- **AND** the base version does not change

### Requirement: Invalidation preserves history

An `invalidate` op MUST mark the target entry `invalidated` with
`invalidatedBy` and `invalidatedAt` instead of deleting it. `materializeBase`
MUST exclude invalidated entries while the base snapshot and proposal history
keep them recoverable.

#### Scenario: Invalidated fact disappears from materialization

- **GIVEN** an accepted invalidation of a fact
- **WHEN** `materializeBase` runs
- **THEN** the rendered text excludes that fact
- **AND** `loadBase` still returns the entry as `invalidated` with its proposal id

### Requirement: Materialization never writes canonical files

`materializeBase` MUST return rendered canonical text using the existing
renderer and MUST NOT modify the CPC memo or auto-write canonical knowledge
from `acceptDelta`.

#### Scenario: Accept does not rewrite project.md

- **GIVEN** a CPC memo and an accepted proposal
- **WHEN** `materializeBase` runs
- **THEN** the memo content is unchanged
