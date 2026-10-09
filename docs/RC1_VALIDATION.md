# RC1 Validation Runbook

This document enables any developer to validate an RC1 build of opencode-wait-a-minute from a clean state.

## Environment

```text
OS:        Linux/macOS (tested on Ubuntu 24.04)
Node:      >=20 (tested on 24.16.0)
npm:       >=10
OpenCode:  >=1.18.0 (tested on 1.18.33)
```

Verify:
```bash
node --version   # >=20
npm --version    # >=10
opencode --version  # >=1.18.0
```

---

## 1. Fresh Install

```bash
git clone https://github.com/khnker/opencode-wait-a-minute.git
cd opencode-wait-a-minute
npm ci
```

Expected: `npm ci` completes without errors, `node_modules/` populated.

---

## 2. Unit & Integration Tests

```bash
npm test
```

Expected: All tests pass (exit code 0).

What runs:
- All `*.test.mjs` files in repo (via `scripts/run-tests.mjs`)
- Including `wait-a-minute-test.mjs` legacy suite
- Benchmark validation tests (`benchmarks/validation/*.test.mjs`)

---

## 3. Production Gate (Unified Release Gate)

```bash
npm run gate
```

Expected output:
```text
WAM RELEASE GATE

Unit              PASS (xxxxms)
Behavioral        PASS
Regression        PASS
Validation        PASS
Package           PASS
Smoke             PASS
Benchmark         PASS

TOTAL             PASS
```

This is the single gate command that aggregates all validation.

---

## 4. Package Integrity

```bash
npm pack
npm run verify:package
```

Expected output:
```text
[pack] running npm pack...
[pack] pack output: ...
[install] installing package...
[install] installed to /tmp/wam-pack-test-...
[verify] loading package from installed location...
[verify] registry loaded: 500+ skills
[verify] critical files present
SUCCESS: package verified
```

What this validates:
- `npm pack` produces a valid tarball
- Tarball installs cleanly in an isolated temp directory
- Installed package exports `loadBundledRegistry()` with >500 skills
- Critical runtime files present: `index.js`, `preflight/request-classifier.js`, `skills/registry.json`

---

## 5. Package E2E (Clean Install from Tarball)

```bash
npm run test:e2e:package
```

Expected: Exit code 0.

What this validates:
- The installed package (from tarball) can be loaded by a real OpenCode runtime
- Same E2E scenarios as local source pass against the installed artifact

> ⚠️ Requires real OpenCode binary on PATH (1.18.33+).

---

## 6. OpenCode Real E2E

```bash
npm run test:e2e:opencode
```

Expected: All E2E scenarios pass (exit code 0).

Scenarios executed:
1. **E2E-001** — Plugin load (OpenCode starts, WAM loads, no exception)
2. **E2E-002** — Prompt passthrough (prompt received, observed, passed through)
3. **E2E-003** — Task normal (task lifecycle: start → assessment → execution → completion → verified)
4. **E2E-004** — Completion without evidence (claim → gate → BLOCKED)
5. **E2E-005** — Completion with evidence (claim → evidence → verification → DONE)
6. **E2E-006** — Assumption gate (ambiguous input → assumption detected → refused)
7. **E2E-007** — Reentrancy (task A → terminal state → task B independent)
8. **E2E-008** — Malformed event (invalid event → handled safely)
9. **E2E-009** — Graceful degradation (optional capability missing → degrades safely)

> ⚠️ This test installs WAM as a real OpenCode plugin via temporary `opencode.jsonc` config. It does not mock the plugin loader.

---

## 7. Migration E2E

```bash
npm run test:e2e:migration
```

Expected: All migration scenarios pass (exit code 0).

Fixtures tested:
- **legacy-valid** — Valid legacy `.wam` state migrates cleanly
- **legacy-partial** — Incomplete state gets safe defaults, no crash
- **legacy-corrupt** — Corrupted state detected, fails safely
- **task-isolation** — Task A and B states remain isolated after reload

---

## 8. Task Isolation Regression Test

```bash
npm run test:isolation
```

Expected: Pass.

Specific regression cases:
- `task A → DONE → "terminé" in conversation → task B starts` — no duplicate task created
- Completion language ("done", "completed", "terminé") does not trigger new task identity

---

## 9. Version Parity Check

```bash
npm run verify:version
```

Expected: Exit code 0.

Validates:
- `package.json.version` === `SKILL.md.metadata.version`

---

## 10. Performance Sanity

```bash
npm run perf:sanity
```

Expected: Metrics printed, no hard threshold failures (baseline captured on first RC1 run).

Output example:
```json
{
  "pluginInitMs": { "median": 12, "p95": 18 },
  "assessmentMs": { "median": 45, "p95": 82 },
  "contextAssemblyMs": { "median": 30, "p95": 55 }
}
```

---

## 11. Security / Package Audit

```bash
npm audit
```

Expected: No `high` or `critical` vulnerabilities in production dependencies.

Also runs:
```bash
npm run verify:security
```

Which scans the tarball for forbidden files:
- `.env`, `*.pem`, `*.key`, `id_rsa*`, `*.secret`
- `.wam/` local state
- `.git/`, `.github/`
- `node_modules/`

---

## 12. Post-Publish Verification (After `npm publish`)

```bash
npm run verify:published
```

Input: `npm run verify:published opencode-wait-a-minute@1.1.0`

Validates:
- Registry artifact matches local tarball (content + checksum)
- Clean install of published package works
- Smoke test passes on installed artifact

---

## Summary Checklist

```text
[ ] npm ci
[ ] npm test
[ ] npm run gate
[ ] npm pack && npm run verify:package
[ ] npm run test:e2e:package
[ ] npm run test:e2e:opencode
[ ] npm run test:e2e:migration
[ ] npm run test:isolation
[ ] npm run verify:version
[ ] npm run perf:sanity
[ ] npm audit
[ ] npm run verify:security
```

All green → **RC1 VALIDATED**.

If any step fails → document failure, do not proceed to publish.