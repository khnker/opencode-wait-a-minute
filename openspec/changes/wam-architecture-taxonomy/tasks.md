# Tasks

- [x] Inventory all production modules.
- [x] Assign a semantic owner to each module.
- [x] Identify modules with unclear ownership.
- [x] Identify current cross-cutting infrastructure.
- [x] Identify accidental shared utilities.
- [x] Map preflight responsibilities.
- [x] Map context responsibilities.
- [x] Map task responsibilities.
- [x] Map execution responsibilities.
- [x] Map verification responsibilities.
- [x] Map skills responsibilities.
- [x] Map runtime responsibilities.
- [x] Map orchestration responsibilities.
- [x] Define legitimate shared responsibilities.
- [x] Document dependency direction.
- [x] Identify dependency violations.
- [x] Identify potential circular dependencies.
- [x] Produce complete source ownership map.
- [x] Resolve ambiguous ownership decisions.
- [x] Review taxonomy against extensibility findings.
- [x] Approve taxonomy before physical migration.

## Validation

- [x] `docs/architecture/ownership-map.md` lists every module with an owner (124/124, no UNASSIGNED).
- [x] Dependency direction documented; violations enumerated (0 violations, 0 cycles).
- [ ] `openspec validate wam-architecture-taxonomy --strict` passes.
