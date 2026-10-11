## ADDED Requirements

### Requirement: Canonical Name in README

The README (EN and ES) MUST display the package name as `opencode-wait-a-minute` and the clone URL MUST be `https://github.com/khnker/opencode-wait-a-minute.git`.

#### Scenario: EN README clone and install instructions

- **WHEN** a user reads the clone or install section in README.md
- **THEN** the package name reads `opencode-wait-a-minute`
- **AND** the clone URL is `https://github.com/khnker/opencode-wait-a-minute.git`

#### Scenario: ES README clone and install instructions

- **WHEN** a user reads the clone or install section in README_es.md
- **THEN** the package name reads `opencode-wait-a-minute`
- **AND** the clone URL is `https://github.com/khnker/opencode-wait-a-minute.git`

### Requirement: Canonical Name in Docs

All docs under `docs/` MUST use `opencode-wait-a-minute` for every package reference. The legacy filename `wait-a-minute-test.mjs` MAY remain when referring to the legacy test-suite filename.

#### Scenario: Architecture and compatibility docs

- **WHEN** the reader opens `docs/architecture-boundaries.md` or `docs/architecture/compatibility.md`
- **THEN** every package reference is `opencode-wait-a-minute`
- **AND** the legacy `wait-a-minute-test.mjs` filename is preserved where used

#### Scenario: Release and validation docs

- **WHEN** the reader opens `docs/releases/RC1.md`, `docs/development/release.md`, or `docs/RC1_VALIDATION.md`
- **THEN** every package reference is `opencode-wait-a-minute`
- **AND** the legacy `wait-a-minute-test.mjs` filename is preserved where used

### Requirement: Canonical Name in Sample Scripts

Sample scripts MUST use the canonical `opencode-wait-a-minute` name when referencing the package.

#### Scenario: Sample scripts use canonical name

- **WHEN** `tests/e2e/opencode/smoke.mjs` imports or references the package
- **THEN** the resolved identifier is `opencode-wait-a-minute`

#### Scenario: Verification scripts use canonical name

- **WHEN** `scripts/verify-package.mjs`, `verify-published-package.mjs`, `check-compatibility.mjs`, or `package-e2e.mjs` reference the package
- **THEN** the resolved identifier is `opencode-wait-a-minute`

### Requirement: Tarball Install Assertion

`scripts/verify-tarball-install.mjs` MUST pack the working tree, install the tarball into a fresh `tmpdir()`, read the installed `package.json`, and assert the `name` field equals exactly `opencode-wait-a-minute`. It MUST exit 0 on success and 1 on any failure.

#### Scenario: Verifier succeeds on a healthy package

- **WHEN** the package name in `package.json` is `opencode-wait-a-minute`
- **THEN** the verifier exits 0
- **AND** the installed tarball is reported as the canonical name

#### Scenario: Verifier fails on identity drift

- **WHEN** the package name in `package.json` is not `opencode-wait-a-minute`
- **THEN** the verifier exits 1
- **AND** the actual installed name is reported for debugging

### Requirement: CI/Release Gate Assertion

The release gate MUST run the tarball install assertion and fail if the verifier exits non-zero.

#### Scenario: Release gate runs tarball assertion

- **WHEN** `npm run validate` executes
- **THEN** `node scripts/verify-tarball-install.mjs` runs as part of the gate
- **AND** a non-zero exit from the verifier fails the gate

### Requirement: OpenSpec Delta Validates

The change MUST pass `npx openspec validate package-identity-and-installation` with exit 0.

#### Scenario: Delta validation passes

- **WHEN** the change directory contains `## ADDED Requirements` with at least one `#### Scenario:` block
- **THEN** `npx openspec validate package-identity-and-installation` exits 0
