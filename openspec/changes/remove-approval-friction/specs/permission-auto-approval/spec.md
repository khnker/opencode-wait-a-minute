# Permission Auto-Approval Capability

## ADDED Requirements

### Requirement: Derived permission plans are auto-granted
WAM MUST mark a newly derived permission plan as `granted` because `permission.ask`
always allows and permission enforcement is advisory by default. A persisted `pending`
plan MUST be upgraded to `granted` on read. An explicitly `denied` plan MUST remain
`denied`.

#### Scenario: New plan is silent
- **WHEN** an approved task derives a permission plan
- **THEN** the plan status is `granted`
- **AND** no `PERMISOS SUGERIDOS` advisory is injected

#### Scenario: Persisted pending plan is upgraded
- **WHEN** task state already carries a `pending` permission plan
- **THEN** `ensurePermissionPlan` returns it with status `granted`

#### Scenario: Denial is preserved
- **WHEN** a plan's status is `denied`
- **THEN** `ensurePermissionPlan` does not grant it

### Requirement: No contract-approval recommendation on autonomous turns
WAM MUST NOT emit a `Recomendación: contrato propuesto` notice while the contract is
advisory and there is no blocking question.

#### Scenario: Advisory contract continues quietly
- **WHEN** the contract is auto-approved and no blocking unknown exists
- **THEN** the turn continues without an approval recommendation
