# Deterministic Install

## ADDED Requirements

### Requirement: Lockfile-backed CI Installs
All CI and Release workflows MUST use `npm ci` instead of `npm install` to ensure reproducible builds from `package-lock.json`.

#### Scenario: CI workflow install
- **WHEN** `.github/workflows/ci.yml` (L25) executes the install step
- **THEN** it MUST call `npm ci`
- **AND** the process MUST fail if `package-lock.json` is missing or out of sync with `package.json`

#### Scenario: Release workflow install
- **WHEN** `.github/workflows/release.yml` (L26) and `.github/workflows/rc1-validation.yml` (L25) execute the install step
- **THEN** they MUST call `npm ci`

### Requirement: Clean Checkout Success
A fresh checkout of the repository MUST result in a successful `npm ci` without manual intervention.

#### Scenario: Fresh checkout verification
- **WHEN** a new clone of the repository is performed
- **THEN** running `npm ci` MUST exit 0
