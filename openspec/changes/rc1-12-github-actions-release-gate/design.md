# Design: GitHub Actions Release Gate

## Approach
RC1 must not depend on manually running the gates.

## Scope
- `ci.yml`: install -> lint -> unit -> integration -> deterministic benchmark.
- `e2e.yml`: install -> package -> clean install -> OpenCode -> real E2E.
- `release-gate.yml`: all mandatory gates -> package validation -> E2E -> evidence validation.

## Validation Strategy
- All three workflows exist and run the specified gates.
- Failing gates block merge/release.
- No manual step required.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
