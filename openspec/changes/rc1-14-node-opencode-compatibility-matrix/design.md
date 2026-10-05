# Design: Node / OpenCode Compatibility Matrix

## Approach
Compatibility claims must be precise and testable, not implied by a single install.

## Scope
- Document supported Node versions and OpenCode tested/minimum versions.
- Encode them as an E2E fixture/config.
- Avoid claiming OpenCode compatibility from a single concrete install.

## Validation Strategy
- Matrix documented.
- Fixture/config drives E2E.
- Unsupported versions fail fast.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
