# Tasks

## Preparation

- [ ] Verify all previous audit changes are complete.
- [ ] Produce final source ownership map.
- [ ] Produce final test ownership map.
- [ ] Produce benchmark ownership map.
- [ ] Identify public/package entrypoints.
- [ ] Identify OpenCode integration entrypoints.
- [ ] Identify runtime discovery paths.
- [ ] Identify CI assumptions about paths.

## Source Migration

- [x] Create `src/context`.
- [x] Create `src/cognition`.
- [x] Create `src/execution`.
- [x] Create `src/verification`.
- [x] Create `src/state`.
- [x] Create `src/policy`.
- [x] Create `src/evidence`.
- [x] Create `src/skills`.
- [x] Create `src/persistence`.
- [x] Create `src/integration`.
- [x] Create `src/shared`.
- [x] Move source files according to ownership map.
- [x] Consolidate root-level domain dirs into `src/<domain>/` (policy, task, verification, integration, prompt, rate, recovery, registry, replay, secrets, telemetry, tokens, update, validation, projections).
- [x] Resolve `verification/verification.js` collision (orphaned root stubs removed).
- [x] Update imports.
- [x] Remove obsolete source locations (including the `src/pillars/` container).
- [x] Check for circular dependencies.

## Tests

- [ ] Create `tests/unit`.
- [ ] Create `tests/integration`.
- [ ] Create `tests/behavioral`.
- [ ] Create `tests/e2e`.
- [ ] Mirror semantic ownership for unit tests.
- [ ] Move cross-domain tests to integration/behavioral.
- [ ] Update test configuration.
- [ ] Update test imports.
- [ ] Remove obsolete test locations.

## Benchmarks

- [ ] Create benchmark taxonomy.
- [ ] Move context benchmarks.
- [ ] Move token-efficiency benchmarks.
- [ ] Move lifecycle benchmarks.
- [ ] Move live benchmarks.
- [ ] Move deterministic benchmarks.
- [ ] Update benchmark scripts.
- [ ] Verify benchmark outputs remain comparable.

## Documentation

- [ ] Create `docs/architecture`.
- [ ] Create `docs/concepts`.
- [ ] Create `docs/development`.
- [ ] Create `docs/benchmarks`.
- [ ] Move documentation.
- [ ] Update internal links.
- [ ] Add final repository architecture document.
- [ ] Add ownership rules.
- [ ] Add dependency rules.

## Tooling

- [ ] Move reusable repository scripts to `scripts/`.
- [ ] Update package scripts.
- [ ] Update CI configuration.
- [ ] Update OpenCode integration paths.
- [ ] Update skill discovery paths if required.
- [ ] Update packaging configuration.

## Root Cleanup

- [x] Identify every root-level implementation file.
- [x] Move remaining implementation files.
- [x] Remove obsolete root files.
- [x] Verify root contains only intentional repository-level files.

## Validation

- [ ] Run typecheck.
- [x] Run unit tests.
- [ ] Run integration tests.
- [ ] Run behavioral tests.
- [x] Run E2E tests.
- [ ] Run deterministic benchmarks.
- [ ] Run token-efficiency benchmarks.
- [ ] Run live benchmarks where available.
- [x] Run `npm test`.
- [x] Run `npm pack --dry-run`.
- [x] Inspect package contents.
- [x] Validate OpenCode integration.
- [ ] Validate `.wam` behavior.
- [ ] Validate skill discovery.
- [x] Validate CLI/package entrypoints.
- [x] Validate CI.
- [x] Execute final RC1 gate.

## Final Documentation

- [ ] Document final repository structure.
- [ ] Document domain ownership.
- [ ] Document dependency direction.
- [ ] Document shared-module criteria.
- [ ] Document extension workflow.
- [ ] Document benchmark locations.
- [ ] Record migration decisions and exceptions.
