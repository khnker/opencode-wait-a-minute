# Execution Gate Bash Classification

## ADDED Requirements

### Requirement: Quoted command text is never treated as shell syntax

The execution-gate classifier SHALL ignore text inside single quotes, double
quotes and heredoc bodies when deciding whether a bash command mutates files.

#### Scenario: SQL comparison inside a `-c` argument

- **WHEN** `isMutatingToolCall("bash", { command: 'psql -c "SELECT ... >= 2"' })` runs
- **THEN** it returns `false`
- **AND** the analysis gate does not block the tool call

#### Scenario: Mutating word inside quoted SQL

- **WHEN** the command is `psql -c "SELECT cp.id FROM canonical_products cp"`
- **THEN** it returns `false`

#### Scenario: Heredoc body is data

- **WHEN** the command is `psql <<'SQL'` followed by `SELECT ... >= 2` and the
  `SQL` delimiter
- **THEN** it returns `false`

### Requirement: Real shell operators still block

The classifier SHALL treat unquoted output redirections and mutating commands
as mutations.

#### Scenario: File redirection

- **WHEN** the command is `echo hi > out.txt`, `echo hi >> out.txt` or
  `echo hi >| out.txt`
- **THEN** it returns `true`

#### Scenario: Nested shell mutation

- **WHEN** the command is `bash -c "rm -rf build"` or `sh -lc "npm install"`
- **THEN** it returns `true`

#### Scenario: In-place editors and wrappers

- **WHEN** the command is `sed -i.bak s/a/b/ f`, `perl -pi -e 's/a/b/' f` or
  `sudo rm -f f`
- **THEN** it returns `true`

### Requirement: Harmless redirects do not block

The classifier SHALL NOT treat descriptor duplication or writes to standard
device sinks as file mutations.

#### Scenario: Descriptor duplication

- **WHEN** the command is `cmd 2>&1`
- **THEN** it returns `false`

#### Scenario: Discard output

- **WHEN** the command is `cmd 2>/dev/null`
- **THEN** it returns `false`
