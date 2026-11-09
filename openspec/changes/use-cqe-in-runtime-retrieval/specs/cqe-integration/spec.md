# Spec: CQE in the runtime retrieval path

## ADDED Requirements

### Requirement: CQE participates in every runtime retrieval

When CQE mode is `enabled` and the caller has not opted out, WAM MUST consult
the CQE file index on every runtime context retrieval, not only on prompts that
match file-search keywords. CQE results MUST remain augmentation: native
context still wins on error or empty results, and CQE MUST NOT gate
verification or task state.

#### Scenario: Non-search prompt still retrieves file context

- **GIVEN** CQE mode is `enabled`
- **AND** a repository containing a symbol named `parseConfig`
- **WHEN** the prompt is `"explain how parseConfig works"` (no search keyword)
- **THEN** the context package contains CQE `file_context` items
- **AND** the rationale records the CQE retrieval

#### Scenario: Explicit opt-out suppresses CQE

- **WHEN** `cfg.disableCqe` is true, `WAM_CQE=0`, or `WAM_CQE_MODE=disabled`
- **THEN** no CQE engine is queried
- **AND** the synchronous native context package is returned unchanged

#### Scenario: CQE failure does not break the turn

- **WHEN** the CQE engine fails, times out, or returns no matches
- **THEN** the turn continues with native context
- **AND** the failure is reported through `cqeMeta` with a stable failure code
