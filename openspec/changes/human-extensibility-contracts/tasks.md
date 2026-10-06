# Tasks

- [x] Inventory current extension points.
- [x] Identify recurring variation.
- [x] Identify implicit contracts.
- [x] Identify central branching that represents real variation.
- [x] Define explicit contracts.
- [x] Define registration mechanisms.
- [x] Separate registration from execution where appropriate.
- [x] Document lifecycle and failure semantics.
- [x] Add representative extension fixtures.
- [x] Add extension tests.
- [x] Refactor only justified central branching.
- [x] Verify existing capabilities still behave identically.
- [x] Verify a new capability can be implemented independently.
- [x] Verify no unrelated business logic must be modified.
- [x] Document extension workflow.

## Validation

- [x] Extension fixture test passes (new capability added without touching unrelated logic).
- [x] `npm test` exits 0 (2573 pass / 0 fail).
- [ ] `openspec validate human-extensibility-contracts --strict` passes.
