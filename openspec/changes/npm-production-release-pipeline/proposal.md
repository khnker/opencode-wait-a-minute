# Proposal: npm Production Release Pipeline

## Intent

Make npm publication reproducible, gated and suitable for public production package.

## Scope

Add CI and release automation that verifies package before publication and publishes only from explicit release workflow/tag using npm Trusted Publishing/OIDC.

## Non-goals

- No automatic publication on every main-branch push.
- No long-lived npm token committed to GitHub configuration.
- No application runtime changes.
