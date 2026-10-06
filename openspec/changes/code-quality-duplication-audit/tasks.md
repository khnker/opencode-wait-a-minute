# Tasks

- [x] Inventory duplicated production code.
- [x] Inventory duplicated test helpers.
- [x] Inventory duplicated benchmark utilities.
- [x] Inventory duplicated scripts/tooling.
- [x] Classify findings as D1/D2/D3/D4.
- [x] Identify semantic owner per D3 finding.
- [x] Identify accidental D1 duplication (none — 0 byte-identical files).
- [x] Identify structural D2 duplication worth consolidating (evaluateCompletionGate, recordObservation stub).
- [x] Document intentional D4 duplication (task-execution facade, recordDecision domains).
- [ ] Add characterization tests where behavior is insufficiently covered.
- [ ] Consolidate approved duplication.
- [ ] Remove obsolete implementations.
- [ ] Verify imports and dependencies.
- [ ] Run unit tests.
- [ ] Run integration/behavioral tests.
- [ ] Run relevant benchmarks.
- [x] Verify no domain logic was incorrectly moved to `shared`.
- [x] Record unresolved duplication and rationale.

## Validation

- [x] `docs/architecture/duplication-audit.md` produced with no unclassified finding.
- [ ] `npm test` exits 0 after any consolidation.
- [x] `openspec validate code-quality-duplication-audit --strict` passes.
