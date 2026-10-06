# Repository Structure Modernization

## Why

The repository root contains too many implementation-oriented files and does not communicate architecture clearly.

After the duplication, extensibility, documentation, and taxonomy audits, the repository can be reorganized around semantic ownership. The objective is not cosmetic cleanup: structure must make the system easier to navigate, extend, test, benchmark, and maintain.

## What Changes

Organize the repository around explicit boundaries:

```text
src/
├── context/
├── cognition/
├── execution/
├── verification/
├── state/
├── policy/
├── evidence/
├── skills/
├── persistence/
├── integration/
└── shared/

tests/
├── unit/
├── integration/
├── behavioral/
└── e2e/

benchmarks/

docs/

scripts/
```

Repository-specific operational directories such as `.github/`, `.opencode/`, `.wam/`, and package metadata remain at the repository root where appropriate.

## Structural Principles

- Source code belongs under `src/`.
- Tests mirror semantic ownership.
- Cross-domain behavior belongs in `integration/` and `behavioral/` tests.
- Benchmarks are organized by what they measure, not by source location.
- Documentation is organized by reader purpose.
- Scripts are separated from application code.
- Repository metadata remains at root.
- Root-level implementation files are minimized.

## Non-Goals

- Do not change runtime behavior.
- Do not rewrite stable algorithms solely because of file movement.
- Do not move everything into deeply nested directories.
- Do not create empty abstraction layers.
- Do not rename public package APIs unless required by migration.
- Do not alter benchmark semantics.

## Expected Result

Production implementation is organized by semantic ownership; root-level implementation clutter is removed; tests are organized by test responsibility; benchmarks are independently navigable; imports and package entrypoints remain valid; CI remains functional; `npm test` passes; relevant benchmark suites pass; `npm pack --dry-run` succeeds and package contents remain correct; the RC1 validation gate passes.

## Validation

- [ ] Production implementation organized by semantic ownership.
- [ ] Root contains only intentional repository-level files.
- [ ] Imports and package entrypoints remain valid.
- [ ] `npm test`, `npm pack --dry-run`, benchmarks and RC1 gate pass.

## Program

- Order: 5 of 5 (after taxonomy approval)
- Priority: P0
