# Tasks

- [ ] Audit production comments.
- [ ] Audit JSDoc.
- [ ] Audit tests where comments explain important behavior.
- [ ] Audit benchmarks and token-accounting documentation.
- [ ] Classify comments C0-C4.
- [ ] Remove redundant C3 comments.
- [ ] Correct/remove stale C4 comments.
- [ ] Identify C2 architectural gaps.
- [ ] Document task lifecycle invariants.
- [ ] Document completion/verification invariants.
- [ ] Document evidence semantics.
- [ ] Document N0/N1/N2/N3 semantics.
- [ ] Document continuation fast-path constraints.
- [ ] Document persistence/recovery behavior.
- [ ] Document OpenCode integration boundaries.
- [ ] Document token-accounting methodology.
- [ ] Document benchmark methodology.
- [ ] Add JSDoc to important contracts.
- [ ] Verify comments against implementation.
- [ ] Run tests after documentation changes.

## Validation

- [ ] No C4 comments remain in production code.
- [ ] High-risk invariants documented in `docs/`.
- [ ] `npm test` exits 0.
- [ ] `openspec validate code-documentation-quality --strict` passes.
