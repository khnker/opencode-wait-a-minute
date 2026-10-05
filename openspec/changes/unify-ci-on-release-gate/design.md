## Context

The repository accumulated two release-gate scripts:

- `scripts/release-gate.mjs` — the unified RC1 gate with six stages (Version Parity, Package Integrity, Security Audit, Migration & Isolation E2E, OpenCode Smoke E2E, Performance Sanity). `package.json` aliases `gate`, `rc1`, `validate`, and `production:gate` all resolve to it. It is the newer script (RC1 work).
- `scripts/production-gate.mjs` — a legacy subset that runs eight `*.test.mjs` files directly. It predates the unified gate and duplicates suites already discovered by `scripts/run-tests.mjs` (`npm test`).

Until now, `ci.yml` and `release.yml` invoked the legacy subset, so PR CI never exercised the canonical contract. The OpenCode E2E stage also treated a clean exit as success without asserting the model response.

## Goals / Non-Goals

- **Goals**
  - One canonical release command (`npm run gate`) that CI, release, and local validation all use.
  - A CI signal that matches the release contract.
  - An OpenCode E2E that proves the model round-trip, not just plugin load.
  - Remove the duplicated legacy gate.
- **Non-Goals**
  - Adding new deterministic suites to the gate (tracked separately by `harden-production-release-gate`).
  - Changing plugin/runtime behavior.
  - Enabling the real OpenCode E2E inside CI (no provider there).

## Decisions

- **Canonical gate is `scripts/release-gate.mjs`.** All npm aliases already point to it and it is the RC1-era script. The legacy `production-gate.mjs` is retired rather than expanded.
- **CI skips the OpenCode E2E via `WAM_SKIP_OPENCODE_E2E=1`.** GitHub Actions has no configured model provider; the real round-trip is exercised locally. The skip is an explicit, logged exit-0 path.
- **E2E assertion uses an arithmetic prompt whose answer is absent from the prompt** (`"¿Cuánto es 6 multiplicado por 7? Responde solo con el número."` → expect `42`). This avoids the previous self-answering prompt where the literal `42` was already in the prompt text.
- **`production-validation` job removed** from `ci.yml` because the canonical gate now runs on every PR and push.

## Risks / Trade-offs

- **CI runtime increases** on PRs (full gate: version parity, package integrity, security audit, migration/isolation E2E). Mitigation: the E2E stage is skipped and the remaining stages are deterministic and fast.
- **`npm audit` in Security Audit needs network.** GitHub-hosted runners have it; local runs already passed.
- **Retiring `production-gate.mjs` is breaking** for any external caller. Mitigation: documented in the proposal; suites remain covered by `npm test`.
- **Model nondeterminism** could make the E2E assert flaky. Mitigation: the prompt is deterministic arithmetic; the assertion accepts any output containing `42`, and the stage is skipped in CI.

## Migration Plan

1. Point `ci.yml` and `release.yml` at `npm run gate` with `WAM_SKIP_OPENCODE_E2E=1`.
2. Remove the `production-validation` job.
3. Harden `smoke.mjs`.
4. Delete `scripts/production-gate.mjs`.
5. Verify `npm run gate` locally (real E2E) and `openspec validate --all --strict`.

## Open Questions

- Should the gate later fold the deterministic invariants from `harden-production-release-gate` into `release-gate.mjs` stages? (Tracked by that change.)
