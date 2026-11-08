# Release Verification

## ADDED Requirements

### Requirement: Published package verification matches nested globs

The post-publish verifier MUST match files inside nested directories for `**` patterns.

#### Scenario: Vendored source
- **WHEN** `package.json` declares `vendor/**/src/`
- **THEN** `vendor/context-query-core/src/` satisfies the expectation

### Requirement: Package metadata only lists paths that exist

`package.json` MUST NOT declare expected package paths that the repository never produces.

#### Scenario: No vendored dist
- **WHEN** no vendored package contains a `dist/` directory
- **THEN** `vendor/**/dist` is not declared in `files`
