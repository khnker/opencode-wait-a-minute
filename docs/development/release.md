# Release Process

## Release candidates

WAM uses semantic versioning with release candidates (RC) for pre-release validation.

### RC1 gates

To promote an RC to stable, the following gates must pass:

1. **Version Parity**: package.json and SKIP.md versions match
2. **Test Suite**: All unit and integration tests pass
3. **Package Integrity**: npm pack produces a valid tarball
4. **Security Audit**: No high-severity vulnerabilities
5. **Migration E2E**: Migration scenarios work correctly
6. **Isolation E2E**: Task isolation works correctly
7. **OpenCode Smoke E2E**: Basic OpenCode integration works
8. **Package E2E**: Packaged plugin loads and exports a function
9. **Performance Sanity**: Performance regressions are within bounds
10. **Real Benchmark (RC1 evidence)**: Real-world benchmark validates token savings (local only)

## Automated publish (GitHub Actions)

Publishing is automated by [`.github/workflows/release.yml`](../../.github/workflows/release.yml).

- **Trigger:** pushing a tag matching `v*` (e.g. `v1.1.0-rc.1`, `v1.1.0`), or a
  manual `workflow_dispatch` run — use the manual run to (re)publish a tag that
  was already pushed.
- **Version:** derived from the tag (`v1.1.0-rc.1` → `1.1.0-rc.1`) and applied to
  `package.json` before publishing. The tag and the published version must match.
- **Dist-tag:** selected automatically — prereleases (any `-` suffix) publish under
  `next`; stable versions publish under `latest`. Override with the `dist_tag`
  input on a manual run.
- **Auth:** npm Trusted Publishing (OIDC) with provenance — no long-lived token.

### One-time npm setup

Before the first publish, configure Trusted Publishing for the package on
npmjs.com:

1. Package → **Settings** → **Trusted Publisher** → **GitHub Actions**
2. Organization/user: `khnker`
3. Repository: `wait-a-minute-plugin`
4. Workflow filename: `release.yml`

Alternatively, add an `NPM_TOKEN` repository secret (npm Automation token) and
set `NODE_AUTH_TOKEN` on the publish step.

## Release steps

```bash
# 1. Check out main and ensure clean working tree
git checkout main
git pull
git status

# 2. Run RC1 validation locally
WAM_RC1_EVIDENCE=1 npm run rc1

# 3. If all gates pass, tag and push — this triggers the publish workflow
git tag v1.1.0-rc.1
git push origin v1.1.0-rc.1

# 4. Verify the published artifact
npm run verify:published -- wait-a-minute@1.1.0-rc.1
```

Installing a prerelease:

```bash
npm install wait-a-minute@next
```

## Related documentation

- [Testing](testing.md)
- [Contributing](contributing.md)
