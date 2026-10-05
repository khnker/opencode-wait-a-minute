# Change: Real Package Installation Test

## Why
Tests must prove WAM works from the packed artifact in a clean environment, not from the source checkout.

## What Changes
- `npm pack` to a temp dir and install the `.tgz` in a clean OpenCode environment.
- Validate package.json, exports, plugin manifest, skills, runtime, scripts and required docs.
- Validate included/excluded files.
- Fail if it only works from the checkout.

## Non-goals
- Relying on repo node_modules or untracked files.
- Absolute developer paths.

## Expected Result
A clean temp workspace installs the `.tgz` and exercises WAM successfully.

## Validation
- [ ] Install from `.tgz` in a fresh temp env exits 0.
- [ ] Required runtime files present.
- [ ] Skills load.
- [ ] Scripts resolve.
- [ ] Fails when run against the source tree only.

## Program
- RC1 item: RC1-09 (B)
- Priority: P0
