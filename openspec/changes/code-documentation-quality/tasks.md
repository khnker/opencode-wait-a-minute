# Tasks

- [x] Audit production comments.
- [x] Audit JSDoc.
- [ ] Audit tests where comments explain important behavior.
- [x] Audit benchmarks and token-accounting documentation.
- [x] Classify comments C0-C4.
- [x] Remove redundant C3 comments.
- [x] Correct/remove stale C4 comments.
- [x] Identify C2 architectural gaps.
- [x] Document task lifecycle invariants.
- [x] Document completion/verification invariants.
- [x] Document evidence semantics.
- [x] Document N0/N1/N2/N3 semantics.
- [x] Document continuation fast-path constraints.
- [x] Document persistence/recovery behavior.
- [x] Document OpenCode integration boundaries.
- [x] Document token-accounting methodology.
- [x] Document benchmark methodology.
- [x] Add JSDoc to important contracts.
- [x] Verify comments against implementation.
- [x] Run tests after documentation changes.

## Validation

- [x] No C4 comments remain in production code (corrected in `verification-policy.js`).
- [x] High-risk invariants documented in `docs/`.
- [x] `npm test` exits 0 (2573 pass / 0 fail).
- [ ] `openspec validate code-documentation-quality --strict` passes.
