# benchmark-evaluation
## ADDED Requirements
### Requirement: Audit selects validation-format evidence
`latestResultsDir` MUST return only directories whose `raw.json` is a validation-format artifact (containing `composition`), skipping trace-replay artifacts, so `buildAudit` never reads `composition`/`causal` from the wrong file.
#### Scenario: Trace-replay run shadows a validation run
- **WHEN** a newer results directory contains a trace-replay `raw.json` without `composition`
- **THEN** `latestResultsDir` skips it and returns the newest validation-format directory
#### Scenario: No validation artifact present
- **WHEN** no results directory contains a validation-format `raw.json`
- **THEN** `latestResultsDir` returns `null`
### Requirement: Audit provenance works without git
`buildAudit` MUST produce a non-empty commit for every result even when git provenance is unavailable, falling back to `"unknown"`.
#### Scenario: Non-git checkout
- **WHEN** `gitProvenance()` returns `gitSha: null`
- **THEN** `resolveCommit` returns `"unknown"` and the audit validates with `ok: true`
