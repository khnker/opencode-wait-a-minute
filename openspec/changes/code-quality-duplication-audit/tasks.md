# Tasks

- [ ] Inventory duplicated production code.
- [ ] Inventory duplicated test helpers.
- [ ] Inventory duplicated benchmark utilities.
- [ ] Inventory duplicated scripts/tooling.
- [ ] Classify findings as D1/D2/D3/D4.
- [ ] Identify semantic owner per D3 finding.
- [ ] Identify accidental D1 duplication.
- [ ] Identify structural D2 duplication worth consolidating.
- [ ] Document intentional D4 duplication.
- [ ] Add characterization tests where behavior is insufficiently covered.
- [ ] Consolidate approved duplication.
- [ ] Remove obsolete implementations.
- [ ] Verify imports and dependencies.
- [ ] Run unit tests.
- [ ] Run integration/behavioral tests.
- [ ] Run relevant benchmarks.
- [ ] Verify no domain logic was incorrectly moved to `shared`.
- [ ] Record unresolved duplication and rationale.

## Validation

- [ ] `docs/architecture/duplication-audit.md` produced with no unclassified finding.
- [ ] `npm test` exits 0 after any consolidation.
- [ ] `openspec validate code-quality-duplication-audit --strict` passes.
