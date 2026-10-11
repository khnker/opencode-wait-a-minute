# Design: Clean Install Smoke Test

## Approach
The full clean-room flow must be reproducible end to end.

## Scope
- Flow: git checkout -> `npm ci` -> `npm pack` -> clean temp dir -> `npm install package.tgz` -> run smoke.
- No dependence on repo node_modules, untracked files, absolute paths or local config.

## Validation Strategy
- `npm ci` succeeds from a clean checkout.
- `npm pack` succeeds.
- Clean install succeeds.
- Smoke passes.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
