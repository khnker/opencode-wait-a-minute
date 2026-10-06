# Design

## Target Repository

```text
.
├── src/
│   ├── pillars/
│   │   ├── preflight/
│   │   ├── context/
│   │   ├── task/
│   │   ├── execution/
│   │   ├── verification/
│   │   ├── skills/
│   │   └── runtime/
│   ├── orchestration/
│   └── shared/
├── tests/
│   ├── unit/
│   │   ├── pillars/
│   │   ├── orchestration/
│   │   └── shared/
│   ├── integration/
│   ├── behavioral/
│   └── e2e/
├── benchmarks/
│   ├── context/
│   ├── token-efficiency/
│   ├── lifecycle/
│   ├── live/
│   └── deterministic/
├── docs/
│   ├── architecture/
│   ├── concepts/
│   ├── development/
│   └── benchmarks/
├── scripts/
├── skills/
├── .github/
├── .opencode/
├── .wam/
├── package.json
└── .
```

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

Unit tests mirror implementation ownership. Integration and behavioral tests represent interactions between pillars. E2E tests represent externally observable WAM behavior.

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
