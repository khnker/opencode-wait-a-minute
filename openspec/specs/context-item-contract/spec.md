# context-item-contract Specification

## Purpose
TBD - created by archiving change add-context-item-contract. Update Purpose after archive.
## Requirements
### Requirement: Context items carry a validated semantic envelope

Every normalized context item MUST expose `kind`, `status`, `retention`,
`sourceRefs`, `relations`, `scopeType` and `scopeId` alongside the existing
normalization fields, and `validateContextItem(item)` MUST report violations as
`{ ok, errors }` without throwing.

#### Scenario: Unknown kind is rejected

- **GIVEN** an item whose `kind` is not in `CONTEXT_KINDS`
- **WHEN** `validateContextItem` runs
- **THEN** `ok` is `false`
- **AND** `errors` names `kind`

#### Scenario: Unknown status is rejected

- **GIVEN** an item whose `status` is not in `CONTEXT_STATUSES`
- **WHEN** `validateContextItem` runs
- **THEN** `ok` is `false`
- **AND** `errors` names `status`

#### Scenario: Unknown retention is rejected

- **GIVEN** an item whose `retention` is not in `RETENTION_POLICIES`
- **WHEN** `validateContextItem` runs
- **THEN** `ok` is `false`
- **AND** `errors` names `retention`

### Requirement: Scope is a typed owner reference

An item MUST have a scope type in `project | group | task | session` and a
non-empty scope id.

#### Scenario: Missing scope type

- **GIVEN** an item with no `scopeType` and no object `scope`
- **WHEN** `validateContextItem` runs
- **THEN** `ok` is `false`
- **AND** `errors` names `scope`

#### Scenario: Empty scope id

- **GIVEN** an item with `scopeType` valid but `scopeId` empty or whitespace
- **WHEN** `validateContextItem` runs
- **THEN** `ok` is `false`
- **AND** `errors` names `scope.id`

#### Scenario: Object scope is accepted

- **GIVEN** an item with `scope = { type: "group", id: "group-1" }`
- **WHEN** `validateContextItem` runs
- **THEN** `ok` is `true`

### Requirement: Provenance arrays have a validated shape

`sourceRefs` MUST be an array of non-empty strings and `relations` MUST be an
array of `{ type, targetId }` with `type` in `RELATION_TYPES` and a non-empty
`targetId`.

#### Scenario: Malformed sourceRefs

- **GIVEN** `sourceRefs` containing a non-string or an empty string
- **WHEN** `validateContextItem` runs
- **THEN** `ok` is `false`
- **AND** `errors` names `sourceRefs`

#### Scenario: Malformed relation

- **GIVEN** a relation with an unknown `type` or an empty `targetId`
- **WHEN** `validateContextItem` runs
- **THEN** `ok` is `false`
- **AND** `errors` names `relations`

### Requirement: Legacy records normalize without behavior change

`normalizeContextItem` MUST keep every existing field and value for records that
predate this contract, add deterministic defaults, and be idempotent.

#### Scenario: Legacy record

- **GIVEN** a record with only `id`, `type`, `content`, `timestamp`, `scope`
- **WHEN** `normalizeContextItem` runs
- **THEN** `scope` still equals the original string
- **AND** `kind`, `status`, `retention`, `sourceRefs`, `relations`, `scopeType`
  and `scopeId` are present
- **AND** `validateContextItem` returns `ok: true`

#### Scenario: Idempotent normalization

- **GIVEN** any valid raw record
- **WHEN** `normalizeContextItem` runs twice
- **THEN** the second result deep-equals the first

#### Scenario: Non-object input fails soft

- **GIVEN** `null`, `undefined` or a non-object value
- **WHEN** `validateContextItem` runs
- **THEN** it returns `ok: false` and does not throw

### Requirement: Retention policies are explicit

`retention` MUST be one of `active | durable | archivable | ephemeral`.

#### Scenario: Default retention by kind

- **GIVEN** a record with `kind: "DECISION"` and no retention
- **WHEN** `normalizeContextItem` runs
- **THEN** `retention` is `durable`

#### Scenario: Explicit retention is preserved

- **GIVEN** a record with `retention: "ephemeral"`
- **WHEN** `normalizeContextItem` runs
- **THEN** `retention` is `ephemeral`

