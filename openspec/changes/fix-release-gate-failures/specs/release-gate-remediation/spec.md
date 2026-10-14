# release-gate-remediation Specification

## ADDED Requirements

### Requirement: Version source agreement
All declared version sources MUST agree. `package.json#version` and `SKILL.md` frontmatter `metadata.version` MUST be equal, and the canonical release version MUST be `1.1.0`. Divergence MUST fail the release gate.

#### Scenario: Parity passes
- **WHEN** `package.json#version` is `1.1.0` and `SKILL.md` `metadata.version` is `1.1.0`
- **THEN** `scripts/verify-version-parity.mjs` exits 0 and the gate reports PASS

#### Scenario: Divergence blocked
- **WHEN** the two version sources differ
- **THEN** the gate reports FAIL

### Requirement: Scoped fail-closed risk classification
Every tool action MUST resolve to exactly one of SAFE, GUARDED, or BLOCKED. Unknown/unregistered actions within the governed domain MUST fail closed (BLOCKED). Agent runtime/meta tools that do not mutate the repository (e.g. `compress`, `delegate_task`, `call_agent`) MUST bypass classification and MUST NOT be blocked. The meta-tool allowlist MUST be exported as `OUT_OF_SCOPE_TOOLS`.

#### Scenario: Unknown governed action fails closed
- **WHEN** a governed action is not in the capability map
- **THEN** it resolves to BLOCKED

#### Scenario: Meta tool bypasses classification
- **WHEN** a meta/runtime tool in `OUT_OF_SCOPE_TOOLS` is evaluated
- **THEN** it resolves to SAFE and is never blocked

### Requirement: Published surface hygiene
The published tarball MUST exclude development artifacts: `prompts/fixtures/**`, all `**/*.test.js` and `**/*.test.mjs`, `**/bench-*.mjs`, and every `**/node_modules/**` (including nested vendor node_modules). The tarball MUST still include `prompts/` runtime assets and vendor runtime (`index.js`, `src/`, `dist`).

#### Scenario: No dev artifacts packaged
- **WHEN** `npm pack --dry-run` is run
- **THEN** no path matching a fixture, `*.test.*`, `bench-*`, or `node_modules` is listed, and the Security Audit gate reports PASS

### Requirement: Continuation live delta emission
WHEN a task contract is APPROVED and the message is not a DONE claim, the continuation fast-path MUST emit the N2 live task delta even if no persisted live context file exists. It MUST NOT re-emit N1, N3, or the PROPOSED contract.

#### Scenario: N2 emitted without a live context file
- **WHEN** a contract is approved and a continuation message arrives with no `.wam/tasks/<id>/context.md`
- **THEN** the emitted output contains `[wam N2 task]` and no `[wam N1`/`[wam N3`/`PROPOSED`

### Requirement: Performance sanity executes
`scripts/performance-sanity.mjs` MUST bind every module it destructures and MUST run to completion without throwing.

#### Scenario: Sanity run completes
- **WHEN** `node scripts/performance-sanity.mjs` is executed
- **THEN** it completes and reports its phase results without a TypeError

### Requirement: Project test scope
The project test runner MUST NOT execute third-party tests under `vendor/**`, consistent with `prompts-check.mjs`.

#### Scenario: Vendor tests excluded
- **WHEN** `npm test` collects test files
- **THEN** no file under `vendor/` is executed
