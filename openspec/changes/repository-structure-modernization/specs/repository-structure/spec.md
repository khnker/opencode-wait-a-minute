# Repository Structure Modernization

## ADDED Requirements

### Requirement: Semantic Repository Layout
Production code MUST live under `src/` organized by architectural domain (`context`, `cognition`, `execution`, `verification`, `state`, `policy`, `evidence`, `skills`, `persistence`, `integration`, `shared`) with no container folder (`pillars/`, `domains/`, or equivalent); tests MUST be organized by responsibility (`unit/`, `integration/`, `behavioral/`, `e2e/`); benchmarks by measurement dimension; docs by reader purpose; and scripts separated from application code.

#### Scenario: Source organized by ownership
- **WHEN** migration completes
- **THEN** each production module resides under its owning domain directory, or under `shared/` when it is a genuinely cross-cutting primitive

#### Scenario: Root contains only repository-level files
- **WHEN** migration completes
- **THEN** no implementation file remains at the repository root

### Requirement: Migration Preserves Compatibility
Migration MUST preserve package entrypoints, CLI behavior, OpenCode integration, runtime discovery, skill discovery, `.wam` behavior, benchmark invocation, and CI commands.

#### Scenario: Package and integration still work
- **WHEN** migration completes
- **THEN** `npm test`, `npm pack --dry-run`, benchmarks and the RC1 gate pass

#### Scenario: Any compatibility change is explicit
- **WHEN** an unavoidable compatibility change is required
- **THEN** it is documented and tested
