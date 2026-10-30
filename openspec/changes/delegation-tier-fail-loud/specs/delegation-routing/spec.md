# Spec: Delegation routing

## ADDED Requirements

### Requirement: Unknown subagent types are surfaced, not swallowed

The guard MUST keep delegation allowed for a `subagent_type` missing from
`SUBAGENT_TIER_MAP`, resolving the tier to `"medium"` and returning
`unknownSubagentType: true` with a `recommendation` that names the offending type and the
defaulted tier. It MUST NOT throw and MUST NOT block.

#### Scenario: Typo in subagent_type

- **GIVEN** a `task` call with `subagent_type: "wizard"`
- **WHEN** `guardSubagentDispatch` evaluates it
- **THEN** the result has `allowed: true`
- **AND** `unknownSubagentType` is `true`
- **AND** `recommendation` mentions `"wizard"` and `"medium"`

#### Scenario: Known subagent_type

- **GIVEN** a `task` call with `subagent_type: "fast"`
- **WHEN** `guardSubagentDispatch` evaluates it
- **THEN** the result has `allowed: true`
- **AND** it carries neither `unknownSubagentType` nor `recommendation`

#### Scenario: Escalation is unchanged

- **GIVEN** a `fast` subagent with `consecutiveFailures: 2`
- **WHEN** `guardSubagentDispatch` evaluates it
- **THEN** `baseTier` is `"fast"`, `effectiveTier` is `"medium"` and `escalated` is `true`
