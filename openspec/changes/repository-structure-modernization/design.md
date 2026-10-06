# Design

## Target Repository

```text
.
├── src/
│   ├── context/
│   ├── cognition/
│   ├── execution/
│   ├── verification/
│   ├── state/
│   ├── policy/
│   ├── evidence/
│   ├── skills/
│   ├── persistence/
│   ├── integration/
│   └── shared/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── behavioral/
│   └── e2e/
├── benchmarks/
├── docs/
├── scripts/
├── skills/
├── .github/
├── .opencode/
├── .wam/
├── index.js
└── package.json
```

## Domain Rules

- Domain directories live **directly under `src/`**. No container folder
  (`pillars/`, `domains/`, or equivalent) is permitted.
- The directory name is the architectural domain: `context`, `cognition`,
  `execution`, `verification`, `state`, `policy`, `evidence`, `skills`,
  `persistence`, `integration`, `shared`.
- `shared/` is not a functional domain: it holds only genuinely cross-cutting
  primitives (formatting, logging, low-level helpers). It must not become a
  catch-all.
- Every module in `src/` (including previously root-level domain dirs such as
  `policy/`, `task/`, `verification/`, `prompt/`, `tokens/`, `telemetry/`,
  `recovery/`, `rate/`, `registry/`, `replay/`, `secrets/`, `update/`,
  `validation/`, `projections/`) is owned by exactly one domain.

## Migration Order

1. Complete ownership mapping.
2. Complete duplication audit.
3. Complete extensibility audit.
4. Complete documentation audit.
5. Approve taxonomy.
6. Move source files.
7. Move tests.
8. Move benchmarks.
9. Move documentation.
10. Move scripts.
11. Update imports.
12. Update package entrypoints.
13. Update CI.
14. Update documentation references.
15. Validate package contents.
16. Run the RC1 gate.

## File Ownership

A file belongs where its primary responsibility lives. Do not place files according to historical location, number of imports, filename similarity, convenience, or perceived technical complexity.

## Tests

Unit tests mirror implementation ownership. Integration and behavioral tests represent interactions between domains. E2E tests represent externally observable WAM behavior.

## Benchmarks

Benchmarks remain separate from production source and are organized by measurement dimension: context, token efficiency, lifecycle, live behavior, deterministic behavior.

## Root Cleanliness

Root-level files should generally be limited to: package metadata, repository configuration, documentation entrypoints, CI configuration, and required runtime metadata. Implementation files must not remain in root merely to avoid updating imports.

## Compatibility

Migration must preserve: package entrypoints, CLI behavior, OpenCode integration, runtime discovery, skill discovery, `.wam` behavior, benchmark invocation, and CI commands. Any unavoidable compatibility change must be explicit and tested.

## Deliverables

- Migrated `src/`, `tests/`, `benchmarks/`, `docs/`, `scripts/` trees.
- Updated imports, package entrypoints, CI and docs references.
- Migration record with decisions and exceptions.
