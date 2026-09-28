# npm Production Release

## ADDED Requirements

### Requirement: Publication SHALL be gated by the complete validation suite

Release workflow SHALL execute complete test, smoke, package and production-validation gates before publishing.

#### Scenario: Validation fails
- GIVEN any mandatory validation step fails
- WHEN release is attempted
- THEN npm publication does not occur.

#### Scenario: Validation passes
- GIVEN all mandatory validation steps pass on release commit
- WHEN release workflow publishes
- THEN package is published from that validated commit.

### Requirement: Publication SHALL use short-lived trusted authentication

Release workflow SHALL use npm Trusted Publishing/OIDC instead of long-lived npm access token.

#### Scenario: Release publication
- GIVEN release workflow is running on approved release commit
- WHEN npm publication occurs
- THEN authentication is performed through configured trusted publisher
- AND no long-lived npm token is required by workflow.

### Requirement: Published package SHALL be independently installable

Published package SHALL load and execute correctly from clean installation.

#### Scenario: Install published package
- GIVEN package version has been published
- WHEN it is installed into clean temporary project
- THEN production entry point loads
- AND package smoke verification passes.

### Requirement: Release provenance SHALL be available

Published releases SHALL expose provenance linking npm artifact to source/release workflow.

#### Scenario: Inspect published package
- GIVEN release was published through trusted workflow
- WHEN package provenance is inspected
- THEN provenance identifies source commit and publishing workflow.
