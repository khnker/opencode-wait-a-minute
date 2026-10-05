# release-security-gate Specification

## Purpose
TBD - created by archiving change rc1-release-engineering. Update Purpose after archive.
## Requirements
### Requirement: Tri-state Audit Result
The security gate `scripts/verify-security.mjs` MUST classify the results of `npm audit` into exactly three states: PASS, FAIL, or BLOCKED.

#### Scenario: No vulnerabilities
- **WHEN** `npm audit` returns 0 vulnerabilities
- **THEN** the gate MUST return PASS

#### Scenario: High or Critical vulnerabilities
- **WHEN** `npm audit` detects any `high` or `critical` vulnerabilities
- **THEN** the gate MUST return FAIL

#### Scenario: Audit unavailable
- **WHEN** `npm audit` fails due to network errors or registry unavailability
- **THEN** the gate MUST return BLOCKED (exiting non-zero) and MUST NOT treat it as a silent warning or PASS.

### Requirement: Consistent Error Shape
The security gate MUST handle audit errors consistently without referencing properties of undefined objects.

#### Scenario: Audit error reporting
- **WHEN** `npm audit` throws an error
- **THEN** the gate MUST resolve the error message to a string and MUST NOT attempt to read `.message` from an already-stringified error object (fix L62 relative to L45-49).

