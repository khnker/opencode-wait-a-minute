## ADDED Requirements

### Requirement: Importable Core API

`context-query-core` MUST expose a transport-free public API from its package
entry point.

#### Scenario: Importing the package entry

- **WHEN** a consumer imports the package entry (`index.js`)
- **THEN** `createEngine`, `runCQP`, and `runIntent` are exported as functions
- **AND** `EvidenceEvaluator`, `QueryPlanner`, and `Orchestrator` are exported
- **AND** no MCP or transport module is imported by the entry point

### Requirement: Per-Repository Isolation

The engine MUST NOT persist runtime artifacts inside the installed package
directory, and MUST scope cache/index artifacts per target repository.

#### Scenario: No writes into the package directory

- **WHEN** any query is executed via `runCQP` or `runIntent`
- **THEN** no file is written under the package installation directory
- **AND** no file is written into the target repository unless an explicit
  `cacheDir`/`indexDir` inside it was provided

#### Scenario: Distinct repositories get distinct caches

- **WHEN** two different roots are queried in the same process
- **THEN** each root resolves to a distinct cache file
- **AND** cache entries for one root are not reused for the other

#### Scenario: createEngine honors cacheDir

- **WHEN** `createEngine({ root, cacheDir })` is called and `engine.query()` runs
- **THEN** the persisted cache is written under the provided `cacheDir`

### Requirement: Publishable Metadata

The package manifest MUST carry a real identity suitable for registry
publication.

#### Scenario: Manifest identity

- **WHEN** the manifest is inspected
- **THEN** `name` is `context-query-core`
- **AND** `license` is `MIT`
- **AND** `repository`, `bugs`, and `homepage` reference the project URL (no placeholders)
- **AND** a `files` allowlist restricts the packed contents to the public entry,
  `src/`, `README.md`, and `LICENSE`

### Requirement: Clean-Install Verification

The project MUST provide a verifier that installs the packed artifact into a
clean environment and exercises the public API.

#### Scenario: Tarball install and import

- **WHEN** the clean-install verifier runs
- **THEN** it packs the working tree into a tarball
- **AND** installs the tarball into a fresh temporary directory
- **AND** imports the installed entry point and asserts the public API exists
- **AND** constructs `createEngine({ root })` returning an engine with `query()`
- **AND** exits non-zero on any failure
