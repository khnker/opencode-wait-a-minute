# package-allowlist Specification

## Purpose
TBD - created by archiving change rc1-10-package-allowlist. Update Purpose after archive.
## Requirements
### Requirement: Package Allowlist
The published package MUST match an explicit allowlist; dev artifacts MUST NOT ship.

#### Scenario: No dev files ship
- **WHEN** the package is packed
- **THEN** no `*.test.*`, bench or fixture path is present

#### Scenario: Required artifacts ship
- **WHEN** the package is packed
- **THEN** index.js, preflight and skills/registry.json are present

