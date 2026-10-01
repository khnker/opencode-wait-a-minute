# Package Validation

## ADDED Requirements

### Requirement: Validate the Packed Artifact
Package validation MUST test the published artifact, not the repository checkout.

#### Scenario: Fresh-install smoke
- **WHEN** package validation runs
- **THEN** it MUST run `npm pack`, install the resulting tarball into a temporary project, import WAM, and run the plugin smoke check

#### Scenario: Missing runtime file fails validation
- **WHEN** a runtime module, `registry.json`, or a runtime dependency is missing from the tarball
- **THEN** validation MUST fail

#### Scenario: Development files excluded
- **WHEN** the tarball contains development-only files that should not be published
- **THEN** validation MUST fail

#### Scenario: Repository-relative paths rejected
- **WHEN** a packaged path only resolves because it relies on the repository layout
- **THEN** validation MUST fail
