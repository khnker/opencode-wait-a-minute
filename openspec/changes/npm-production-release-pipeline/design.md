# Design: npm Production Release Pipeline

## CI

Pull requests and pushes to default branch run:

1. Checkout;
2. Supported Node runtime;
3. `npm ci`;
4. Unit/invariant tests;
5. Smoke tests;
6. Package verification;
7. Production-validation gate.

The CI job must fail on any failed step.

## Release

Publication occurs only from explicit release tag or release workflow approved by repository maintainers.

Publish job:
- checks out tagged commit;
- repeats complete validation gate;
- builds npm tarball;
- publishes with npm Trusted Publishing/OIDC;
- enables provenance generation;
- does not require long-lived npm access token.

## Package metadata

Ensure package metadata identifies canonical Git repository, package homepage, issue tracker, license, supported Node version and public publish access.

Release workflow must publish exact commit that passed validation.
