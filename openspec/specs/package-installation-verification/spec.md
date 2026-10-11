# package-installation-verification Specification

## Purpose
TBD - created by archiving change rc1-09-real-package-installation. Update Purpose after archive.
## Requirements
### Requirement: Real Package Installation Test
The plugin MUST be installable and runnable from the packed tarball in a clean environment.

#### Scenario: Clean install works
- **WHEN** the `.tgz` is installed in a clean temp dir
- **THEN** the plugin loads from the installed artifact

#### Scenario: Source-only success is rejected
- **WHEN** only the checkout works
- **THEN** the test FAILS

