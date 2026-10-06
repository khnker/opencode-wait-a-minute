# Tasks

- [ ] Inventory current extension points.
- [ ] Identify recurring variation.
- [ ] Identify implicit contracts.
- [ ] Identify central branching that represents real variation.
- [ ] Define explicit contracts.
- [ ] Define registration mechanisms.
- [ ] Separate registration from execution where appropriate.
- [ ] Document lifecycle and failure semantics.
- [ ] Add representative extension fixtures.
- [ ] Add extension tests.
- [ ] Refactor only justified central branching.
- [ ] Verify existing capabilities still behave identically.
- [ ] Verify a new capability can be implemented independently.
- [ ] Verify no unrelated business logic must be modified.
- [ ] Document extension workflow.

## Validation

- [ ] Extension fixture test passes (new capability added without touching unrelated logic).
- [ ] `npm test` exits 0.
- [ ] `openspec validate human-extensibility-contracts --strict` passes.
