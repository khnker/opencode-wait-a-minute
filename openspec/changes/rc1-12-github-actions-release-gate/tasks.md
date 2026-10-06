# Tasks
## Implementation
- [x] `ci.yml`: install -> `npm test` -> unified release gate (`npm run gate`) on push/PR to `main`.
- [x] `rc1-validation.yml`: install -> unified release gate -> RC1 evidence bundle (on `v1.1.0-rc.*` tags and manual dispatch).
- [x] `release.yml`: install -> unified release gate -> smoke -> packaged artifact test -> npm publish (OIDC) on `v*` tags.
- [x] All workflows exist and run the mandatory gates through the unified `npm run gate`.
- [x] Failing gates exit non-zero, failing the job (blocks merge/release where branch protection is enabled).
- [x] No manual step required.
- [x] OpenCode Smoke E2E is skipped on GitHub Actions (no configured provider) and enforced locally.
## Validation
- [x] Workflows invoke `npm run gate` (all mandatory gates).
- [x] `openspec validate rc1-12-github-actions-release-gate --strict` passes.
