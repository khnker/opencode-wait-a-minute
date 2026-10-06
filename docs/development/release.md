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

## Release steps

\`\`\`bash
# 1. Check out main and ensure clean working tree
git checkout main
git pull
git status --clean

# 2. Run RC1 validation locally
WAM_RC1_EVIDENCE=1 npm run rc1

# 3. If all gates pass, create release tag
git tag v1.1.0
git push origin v1.1.0

# 4. Publish to npm
npm publish
\`\`\`

## Related documentation

- [Testing](testing.md)
- [Contributing](contributing.md)
