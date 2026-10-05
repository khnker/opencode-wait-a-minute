# Tasks

## Implementation
- [ ] Flow: git checkout -> `npm ci` -> `npm pack` -> clean temp dir -> `npm install package.tgz` -> run smoke.
- [ ] No dependence on repo node_modules, untracked files, absolute paths or local config.
- [ ] `npm ci` succeeds from a clean checkout.
- [ ] `npm pack` succeeds.
- [ ] Clean install succeeds.
- [ ] Smoke passes.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-11-clean-install-smoke --strict` passes.
