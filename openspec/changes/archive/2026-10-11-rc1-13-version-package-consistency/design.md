# Design: Version / Package Consistency

## Approach
Version drift across package.json, README, CHANGELOG, plugin manifest and git tag undermines releases.

## Scope
- Assert equality of package.json version, README version, CHANGELOG version, plugin manifest version and git tag.
- Fail the gate on divergence.

## Validation Strategy
- A mismatch in any source fails the gate.
- A matching set passes.
- The check runs in CI and locally.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
