# published-package-verification Specification

## Purpose
TBD - created by archiving change rc1-release-engineering. Update Purpose after archive.
## Requirements
### Requirement: Registry-backed Exact Version Install
The `scripts/verify-published-package.mjs` script MUST verify the package by installing the exact version from the registry, not by checking a local directory.

#### Scenario: Version verification
- **WHEN** `verify:published` is executed
- **THEN** it MUST run `npm install <package-name>@<exact-version>`
- **AND** it MUST verify that the installed files match the expected tarball content.

### Requirement: Script Runtime Validity
The verification script MUST be syntactically and logically correct for the Node.js runtime.

#### Scenario: Imports and Async
- **WHEN** the script executes
- **THEN** it MUST have `existsSync` imported from `fs`
- **AND** it MUST handle the dynamic `import` of the published package within an `async` context (fix `main()` at L32).

### Requirement: Post-publish Workflow Verification
The release workflow MUST verify the published package before completing.

#### Scenario: Registry propagation wait
- **WHEN** `npm publish` completes in `.github/workflows/release.yml`
- **THEN** the workflow MUST wait for registry propagation
- **AND** then run `npm install <version>` followed by `npm run verify:published`
- **AND** the workflow MUST fail if the verification fails.

