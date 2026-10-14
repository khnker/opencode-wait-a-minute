# Design — Fix Release Gate Failures

## Context

The release gate aggregates 15 checks. Five are red. Root causes are independent and each has a single, minimal, spec-grounded fix. The policy/risk failure is a behavioral regression relative to the still-active `action-risk-envelope` change, so the fix restores behavior rather than weakening tests.

## Decisions

### D1 — Version parity: `package.json` → `1.1.0`
`openspec/specs/version-consistency/spec.md` mandates agreement between version sources. The parity checker (`scripts/verify-version-parity.mjs`) parses `SKILL.md` with `([\d.]+)` and cannot represent a prerelease suffix, and the archived `rc1-13-version-package-consistency` change set both files to `1.1.0`. No other gate references the `-rc` suffix (verified across gate scripts). Therefore `1.1.0` is canonical and `package.json` must drop `-rc.11`. `package-lock.json` version fields are aligned to the same value.

### D2 — Scoped fail-closed (not blind default-SAFE)
`action-risk-envelope` (active) requires: every action resolves to SAFE/GUARDED/BLOCKED; unknown/unregistered actions in the governed domain fail closed (`UNKNOWN → BLOCKED`); agent runtime/meta tools that do not mutate the repository (`compress`, `delegate_task`, `call_agent`) MUST bypass classification and MUST NOT be blocked. The current source is blind default-SAFE, which both fails the fail-closed tests and violates the spec. Restore scoped fail-closed and re-export `OUT_OF_SCOPE_TOOLS` (the meta-tool allowlist the tests import). Tests are the spec-aligned artifact here; the source is corrected to satisfy them.

### D3 — Published surface allowlist
`prompts/` currently drags `prompts/fixtures/**` into the tarball, and `vendor/` drags vendored `test/` files and nested `node_modules` (the Security Audit failure). Fix `files` with ordered positive globs plus negations that apply to the vendor subtree. Confirmed via `npm pack --dry-run --json` that fixture/test/bench/node_modules paths drop to zero while vendor runtime ships.

### D4 — Continuation N2 emission
`src/integration/message-handler.js` gates the continuation emit behind `if (live)`, and `readLiveContext` returns `""` when `.wam/tasks/<id>/context.md` is absent, so `output.parts` stays empty. The approved-contract fast-path must emit the N2 live delta regardless of a persisted live file; N1/N3 and the PROPOSED contract must not be re-emitted.

### D5 — Performance sanity binding
`buildPhases` destructures 6 names from a 5-element `Promise.all`, so `engine` is `undefined` and line 86 throws. Add the missing loader (or import the four symbols from their real modules).

### D6 — Test scope
`scripts/run-tests.mjs` globs every `*.test.mjs` except a fixed ignore set that omits `vendor`, so vendored libraries' own tests run and fail on a missing fixture (`vendor/context-query-core/benchmarks/cqe-benchmark.mjs`). `prompts-check.mjs` already ignores `vendor`. Add `vendor` to the test runner ignore set.

## Risks / Trade-offs

- Lowering `package.json` to `1.1.0` changes the artifact name from `...-1.1.0-rc.11.tgz` to `...-1.1.0.tgz`; smoke/tarball gates derive the name dynamically, so this is safe (to be confirmed by re-running the gate).
- Excluding vendor tests removes their signal from our gate; acceptable because they are third-party and their fixture gap is out of our control.
- Restoring fail-closed must not block meta tools, or smoke/runtime flows could regress; the `OUT_OF_SCOPE_TOOLS` bypass is the guard.

## Verification

`npm run gate` must report all 15 gates PASS (exit 0). Targeted: `node scripts/verify-version-parity.mjs`, `npm test`, `node scripts/verify-security.mjs`, `node tests/e2e/opencode/smoke.mjs`, `node scripts/performance-sanity.mjs`.
