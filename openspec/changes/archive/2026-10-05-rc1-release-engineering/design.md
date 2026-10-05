# Design: RC1 Release Engineering

## Context
The current release process has several "silent failure" modes and non-deterministic steps. Specifically:
- `npm install` in CI can lead to different dependency trees.
- The security gate treats network errors as warnings.
- The published-package verifier has runtime bugs (missing imports, async issues) and checks local files instead of the registry.
- The RC1 evidence gate can "pass" without actually running the real-LLM benchmarks.
- Performance sanity is a placeholder (`fs.stat`).

## Goals
- **Hardened Reproducibility**: Switch to `npm ci` and lockfile enforcement.
- **Verifiable Shipping**: Registry-backed verification of the actual published artifact.
- **Honest Evidence**: Mandatory real-benchmark runs for RC1 with explicit provenance and separated metrics.
- **Runtime Baselines**: Transition performance checks from "file exists" to "actual latency measured".

## Decisions
- **Lockfile-first**: Use `npm ci` across all critical paths. This is the industry standard for deterministic CI.
- **Tri-state Security**: Instead of PASS/FAIL, introduce BLOCKED for environmental failures (network/registry). This prevents "silent passes" when the audit can't run.
- **Registry-true Verification**: The only way to verify a publish is to install from the registry. The script will be fixed to use `npm install` of the specific version.
- **Evidence Bundle**: Formalize the `benchmarks/reports/rc1/` directory as the "Gold Standard" for RC1, requiring a specific set of JSON/MD files with full provenance.
- **Metric Split**: `TokenReductionPct` is ambiguous. We will split it into `context_reduction` (raw savings), `wam_overhead` (the cost of WAM), and `net_input_savings` (the actual gain).
- **Surface Freeze**: To avoid breaking the published package during the 286-file root-to-src migration, we first define the `files` field in `package.json` to "freeze" what is shipped.

## Risks / Trade-offs
- [Risk] `npm ci` failure on outdated lockfile → [Mitigation] This is intended; it forces developers to commit the lockfile.
- [Risk] Registry rate-limits during `verify:published` → [Mitigation] Add a retry loop with exponential backoff to the verification script.
- [Risk] High latency in `performance-sanity` benchmarks → [Mitigation] Keep it non-blocking for the final RC1 gate but record the data for the evidence bundle.

## Migration Plan
1. Update workflows to `npm ci`.
2. Fix `verify-security.mjs` and `verify-published-package.mjs`.
3. Update `release-gate.mjs` and `run-real.mjs` to enforce the real benchmark and provenance.
4. Implement real measurements in `performance-sanity.mjs`.
5. Freeze `package.json` surface.
6. Cleanup stale docs.
