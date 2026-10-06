# Tasks

- [ ] Inventory all production modules.
- [ ] Assign a semantic owner to each module.
- [ ] Identify modules with unclear ownership.
- [ ] Identify current cross-cutting infrastructure.
- [ ] Identify accidental shared utilities.
- [ ] Map preflight responsibilities.
- [ ] Map context responsibilities.
- [ ] Map task responsibilities.
- [ ] Map execution responsibilities.
- [ ] Map verification responsibilities.
- [ ] Map skills responsibilities.
- [ ] Map runtime responsibilities.
- [ ] Map orchestration responsibilities.
- [ ] Define legitimate shared responsibilities.
- [ ] Document dependency direction.
- [ ] Identify dependency violations.
- [ ] Identify potential circular dependencies.
- [ ] Produce complete source ownership map.
- [ ] Resolve ambiguous ownership decisions.
- [ ] Review taxonomy against extensibility findings.
- [ ] Approve taxonomy before physical migration.

## Validation

- [ ] `docs/architecture/ownership-map.md` lists every module with an owner (no UNASSIGNED).
- [ ] Dependency direction documented; violations enumerated.
- [ ] `openspec validate wam-architecture-taxonomy --strict` passes.
