## ADDED Requirements

### Requirement: Synchronous Selector Contract Preserved

`selectContext` MUST remain synchronous so that `assembleContext` and its
callers do not require `await`.

#### Scenario: Existing synchronous callers

- **WHEN** any existing caller invokes `selectContext(task, opts)`
- **THEN** it receives a context package synchronously (not a Promise)
- **AND** `assembleContext` continues to return a package without being `async`

### Requirement: CQE-Augmented Context Entrypoint

The system MUST provide an asynchronous entrypoint that augments the context
package with CQE file context for file-search intents.

#### Scenario: File-search intent with CQE results

- **WHEN** `selectContextWithCqe(task, opts)` is called with a task containing a
  file-search intent (e.g. `find`, `search`, `grep`, `locate`, `where is`)
- **AND** CQE returns at least one item
- **THEN** the returned package has `file_context` populated with the items
- **AND** `rationale` includes an entry beginning with `CQE:`

#### Scenario: Non-file-search intent

- **WHEN** `selectContextWithCqe` is called with a task that has no file-search intent
- **THEN** the returned package equals the synchronous `selectContext` result
- **AND** no CQE retrieval is performed

### Requirement: Best-Effort Augmentation

CQE augmentation MUST NOT throw or gate the native context package.

#### Scenario: CQE error or empty result

- **WHEN** CQE throws or returns no items
- **THEN** `selectContextWithCqe` still resolves with the native package
- **AND** no exception propagates to the caller

#### Scenario: Opt-out

- **WHEN** `opts.disableCqe` is true (or `WAM_CQE_MODE=disabled`)
- **THEN** no CQE retrieval is performed
- **AND** the returned package equals the synchronous result

### Requirement: Explicit Repository and No State Transition

CQE retrieval MUST use an explicit repository root and MUST NOT transition task
state.

#### Scenario: Repository is explicit

- **WHEN** CQE retrieval runs
- **THEN** it uses `opts.root` as the repository root
- **AND** it does not rely on an accidental `process.cwd()`

#### Scenario: No state transition on CQE success

- **WHEN** CQE returns file context successfully
- **THEN** no task lifecycle state is changed
- **AND** CQE success is not treated as task verification
