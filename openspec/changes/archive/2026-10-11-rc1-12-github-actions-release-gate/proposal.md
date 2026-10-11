# Change: GitHub Actions Release Gate

## Why
RC1 must not depend on manually running the gates.

## What Changes
- `ci.yml`: install -> test suite -> unified release gate (`npm run gate`).
- `rc1-validation.yml`: install -> unified release gate -> RC1 evidence bundle (tags `v1.1.0-rc.*`).
- `release.yml`: install -> unified release gate -> smoke -> packaged artifact test -> npm publish on `v*` tags.
- OpenCode Smoke E2E is skipped on GitHub Actions (no configured provider) and enforced locally.

## Non-goals
- Manual, undocumented release steps.

## Expected Result
CI enforces every mandatory gate on the relevant triggers.

## Validation
- [x] All three workflows exist and run the mandatory gates via `npm run gate`.
- [x] Failing gates exit non-zero, failing the job (blocks merge/release where branch protection is enabled).
- [x] No manual step required.

## Program
- RC1 item: RC1-12 (D)
- Priority: P0
