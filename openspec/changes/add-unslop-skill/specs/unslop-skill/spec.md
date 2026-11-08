# unslop Skill Capability

## ADDED Requirements

### Requirement: unslop is vendored with attribution

WAM MUST ship the unslop skill under `skills/unslop/` with its upstream license
(CC BY 4.0), a notice naming the author and repository, and a discoverable
`SKILL.md`.

#### Scenario: Skill files are present
- **WHEN** the package is installed
- **THEN** `skills/unslop/SKILL.md`, `LICENSE`, `NOTICE.md` and the referenced
  files under `references/`, `scripts/` and `agents/` exist

#### Scenario: Skill is discoverable
- **WHEN** WAM discovers installed skills
- **THEN** `unslop` is found with `skills/unslop/SKILL.md`

### Requirement: unslop is a base skill for UI/frontend roles

WAM MUST list `unslop` in the preferred skills of the `FRONTEND_ENGINEER` and
`UX_DESIGNER` roles.

#### Scenario: Frontend role loads unslop
- **WHEN** role skills are resolved for `FRONTEND_ENGINEER` or `UX_DESIGNER`
- **THEN** the loaded skill ids include `unslop`

### Requirement: Adding unslop does not displace existing frontend skills

The role skill budget MUST be large enough to inject `unslop` together with the
existing `web-design` skill for the frontend role.

#### Scenario: web-design stays loaded
- **WHEN** role skills are resolved for `FRONTEND_ENGINEER`
- **THEN** both `unslop` and `web-design` are loaded
