# Design: Real Package Installation Test

## Approach
Tests must prove WAM works from the packed artifact in a clean environment, not from the source checkout.

## Scope
- `npm pack` to a temp dir and install the `.tgz` in a clean OpenCode environment.
- Validate package.json, exports, plugin manifest, skills, runtime, scripts and required docs.
- Validate included/excluded files.
- Fail if it only works from the checkout.

## Validation Strategy
- Install from `.tgz` in a fresh temp env exits 0.
- Required runtime files present.
- Skills load.
- Scripts resolve.
- Fails when run against the source tree only.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
