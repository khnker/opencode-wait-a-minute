# Tasks

## Data Model

- [x] Define structural index entry model.
- [x] Define semantic dictionary entry model.
- [x] Define association states: discovered, candidate, confirmed, invalid.
- [x] Define evidence representation.
- [x] Add repository identity and indexer version metadata.
- [x] Add content-hash metadata.

## Structural Index

- [x] Implement repository file indexing.
- [x] Extract relevant symbols and structural metadata using existing WAM mechanisms where possible.
- [x] Record imports/exports and relevant dependency relationships.
- [x] Implement content hashing.
- [x] Implement repository-scoped persistence.

## Change Detection

- [x] Detect new files.
- [x] Detect modified files.
- [x] Detect deleted files.
- [x] Detect renames/moves.
- [x] Detect branch changes.
- [x] Implement targeted invalidation.
- [x] Reindex only affected entities and relationships.

## Semantic Dictionary

- [x] Implement concept → candidate resolution.
- [x] Support aliases.
- [x] Store confidence.
- [x] Store supporting evidence.
- [x] Implement candidate/confirmed/invalid lifecycle.
- [x] Prevent unconfirmed LLM inferences from becoming authoritative automatically.
- [x] Preserve valid semantic associations when files are renamed or moved.

## Context Integration

- [x] Run concept resolution before Context Selector.
- [x] Feed dictionary candidates into existing context-selection pipeline.
- [x] Ensure Context Selector remains responsible for minimum-context decisions.
- [x] Ensure dictionary lookup does not bypass existing context-level rules.
- [x] Ensure dictionary failures fall back to existing behavior.

## Reconciliation

- [x] Implement stale-entry detection.
- [x] Implement complete index rebuild.
- [x] Reconcile semantic associations after structural rebuild.
- [x] Invalidate associations whose targets no longer exist.
- [x] Detect incompatible indexer versions.
- [x] Add explicit rebuild capability.

## Tests

- [x] Resolve known concept to confirmed file.
- [x] Resolve unknown concept falls back to discovery.
- [x] Resolve ambiguous concept returns multiple candidates.
- [x] Modified file triggers reindex.
- [x] Deleted file is invalidated.
- [x] Renamed file preserves semantic associations.
- [x] Stale entries are detected and invalidated.
- [x] Incompatible indexer version prevents load.
