# Runtime Hardening

## ADDED Requirements

### Requirement: Production runtime SHALL use the declared module system

Package SHALL execute correctly under its declared ESM module configuration without relying on CommonJS globals.

#### Scenario: Strategy Continuity is activated
- GIVEN package is executed in clean Node process
- AND active strategy requires capability loading
- WHEN Strategy Continuity executes
- THEN capability loading succeeds without `require is not defined` or equivalent module-loader failure.

### Requirement: The packed artifact SHALL be executable

Npm tarball SHALL be capable of loading and executing production entry point independently of source checkout.

#### Scenario: Fresh installation from tarball
- GIVEN tarball produced by `npm pack`
- WHEN it is installed into clean temporary project
- THEN package entry point loads successfully
- AND the Strategy Continuity smoke path executes successfully.
