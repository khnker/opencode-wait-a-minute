# wam-root-identity delta

## MODIFIED Requirements

### Requirement: Contract approval MUST be explicit

A new task contract SHALL be persisted with `contract.status: "PROPOSED"` and
`nextAction: "Revisar contrato — /wam contract approve o edit"`, regardless of
whether the root has pre-existing `.wam` memory. WAM SHALL NOT auto-approve a
contract from a user order, from a first task, or from the advisory default
config.

The advisory default config SHALL NOT block writes and SHALL NOT emit an
approval prompt. An existing contract that is already `APPROVED` SHALL be
preserved (no re-ask, no reset). `/wam contract approve` SHALL remain the only
transition to `contract.status: "APPROVED"`.

#### Scenario: New contract in the default config
- **WHEN** a non-trivial prompt creates a new contract with advisory config
- **THEN** the persisted contract has `status: "PROPOSED"`
- **AND** no approval prompt is emitted and writes are not blocked

#### Scenario: Existing approved contract continues
- **WHEN** a later message arrives for a task whose contract is `APPROVED`
- **THEN** the contract stays `APPROVED`
- **AND** the phase is normalized to `IMPLEMENTING` without re-asking

#### Scenario: Explicit approval
- **WHEN** the user runs `/wam contract approve`
- **THEN** the contract becomes `APPROVED` and the phase becomes `IMPLEMENTING`

#### Scenario: No bootstrap approval
- **WHEN** the first task is created in a root without WAM memory
- **THEN** the contract is `PROPOSED`, not `APPROVED`
- **AND** no `approvedBy: "bootstrap"` value is written
