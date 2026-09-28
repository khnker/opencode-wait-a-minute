# Tasks: npm Production Release Pipeline

## 1. CI
- [x] 1.1 Add GitHub Actions CI workflow.
- [x] 1.2 Pin supported Node major version(s).
- [x] 1.3 Run `npm ci`.
- [x] 1.4 Run unit/invariant tests.
- [x] 1.5 Run smoke tests.
- [x] 1.6 Run package/tarball verification.
- [x] 1.7 Run production-validation gate.

## 2. Release workflow
- [x] 2.1 Add explicit tag/release trigger.
- [x] 2.2 Repeat all release gates before publication.
- [x] 2.3 Configure npm Trusted Publishing/OIDC.
- [x] 2.4 Enable package provenance.
- [x] 2.5 Publish without long-lived npm token.
- [x] 2.6 Ensure published commit is validated release commit.

## 3. Package metadata
- [x] 3.1 Verify `repository`.
- [x] 3.2 Verify `homepage`.
- [x] 3.3 Verify `bugs`.
- [x] 3.4 Verify `license`.
- [x] 3.5 Verify `engines`.
- [x] 3.6 Verify public `publishConfig`.
- [x] 3.7 Verify package `files` includes everything required at runtime and excludes development-only content.

## 4. Release verification
- [ ] 4.1 Publish to npm from release workflow.
- [ ] 4.2 Install published version into clean temporary project.
- [ ] 4.3 Run package smoke verification against published version.
- [ ] 4.4 Verify npm provenance is present for published package.
