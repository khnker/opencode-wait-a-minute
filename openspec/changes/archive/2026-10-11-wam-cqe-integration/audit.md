# CHANGE 01 — CQE Integration Contract & Viability Audit

Status: COMPLETE (research, read-only — no production behavior changed)
Repos audited:
- WAM: `/home/nicolas/dev/wait-a-minute-plugin` — `opencode-wait-a-minute` v1.1.0
- CQE: `/home/nicolas/dev/contextforge` — `context-query-engine` v1.4.0

## 1. Verdict

CQE is **import-safe** at module scope, but is **not yet consumable as a per-repository library** without a refactor:

- Repo root is selected **exclusively through `process.cwd()`**; no `runCQP`/`runIntent` accepts a root/config.
- The engine holds **module-global mutable state** (in-memory `cache` Map + on-disk `CACHE_FILE`).
- `package.json` declares `main: "index.js"`, which **does not exist**. No `exports` map.
- The MCP server (`engine/mcp-server.js`) is a thin transport layer over `runCQP`/`runIntent`; it is the side-effectful entry to avoid importing.

Therefore **CHANGE 02 (extract `cqe-core`)** is a hard gate before CHANGE 03. WAM integration must not start until a factory/env-parameter API replaces `process.cwd()` and global cache.

## 2. CQE surface (file:line)

### Exports (`engine/engine.js`)
| Export | Location | Signature | Returns |
|---|---|---|---|
| `runCQP` | `engine.js:932` | `runCQP(cqpText, opts={})` | `{ plan, results, stats, cached, [receipt] }` |
| `runIntent` | `engine.js:965` | `runIntent(intentText, opts={})` | same object as `runCQP` |
| `clearCache` | `engine.js:64` | `clearCache()` | void; clears in-memory Map + `fs.rmSync(CACHE_FILE)` |

`opts` is threaded to `runPlan(logicalPlan, cqpText, opts)` but **carries no `cwd`/`root`/`config`**. Only `opts._nested` is read (decompose recursion).

### Import safety
- CLI entry is guarded by `isMain` (`engine.js:999`, `context-pack-pipeline.js:183`).
- No module-scope `execFileSync`/`spawn`/`writeFileSync`/`listen(` found. Import does not search, spawn, or write.
- `engine/mcp-server.js:15` imports `readline` and starts a stdio loop at load → **never import this from the core path**.

### Path / config / env / binaries
- Repo root: `process.cwd()` only (multiple sites across engine files) — module and function scope.
- Env vars (process-global, not per-call): `CF_DECOMPOSE`, `CF_IR`, `CF_BUDGET`, `CF_FINGERPRINT`, `CF_STAGES_FILE`.
- External binaries invoked at query time: `rg`, `fd`, `ast-grep`, `probe`, `jq`, `tokei` (via `scripts/` wrappers). Required unless a degraded path applies; degrades must be classified, not silently empty.
- Index: `engine/index-layer/index.js` → `buildIndex(repoDir)` resolves abs, opens `dbPathFor(abs)`, `reconcile(db, abs)`, closes → **mutates disk**. `freshness(repoDir)` reports staleness.
- Cache: in-memory `cache` Map (`engine.js`) + `CACHE_FILE` on disk; `clearCache()` wipes both. Global, not repo-keyed.

### Result / provenance model
- Stable containers: `engine/context-pack.js` (`createContextPack` `:74`, `estimateTokens` `:106`, `packToJSON`/`packFromJSON` `:136/:140`).
- Evidence/provenance pieces: `engine/evidence.js`, `engine/claim.js`, `engine/receipt.js`, `engine/rrf.js` (fusion), `engine/selector.js` (budget selection).
- Deterministic vs probabilistic: RRF fusion + selector can rank; requirement is deterministic matches survive selection (verify in CHANGE 02 tests).

### MCP adapter
`engine/mcp-server.js:24` `TOOLS` are a thin mapping to engine functions; no retrieval logic duplicated. Compatible with the "one engine, MCP as adapter" target of CHANGE 02.

## 3. WAM surface (file:line)

### Where retrieval would plug in (do NOT duplicate)
WAM already owns a full context layer at `src/context/` (~69 files). Anchors:

| Artifact | Role |
|---|---|
| `context-source-registry.js` | id→source registry — **the existing source abstraction** |
| `context-query-contract.js:24` | `buildContextQuery({taskId, subtaskId, budget, ...})` |
| `context-retrieval.js` | `retrieveContext(...)` — rank + constraint filter |
| `context-retrieval-integration.js` | glue: consumes duck-typed `manager.registry.list()` |
| `context-ranking.js` | `rankContextItems(...)` multi-signal ranking |
| `assembly.js` | Context Pack builder + budget partition |
| `context-budget-manager.js` | per-layer token budget enforcement |

**Best injection seam:** the source abstraction consumed by `context-retrieval-integration.js` (currently `manager.registry.list()`), or a provider behind `context-retrieval.js::retrieveContext`. A CQE-backed source MUST satisfy the existing registry/source interface — no parallel retrieval path.

### Evidence / state chain
- Evidence: `src/evidence/*` (`evidence.js`, `evidence-factory.js`, `evidence-engine.js`, `evidence-gap.js`).
- Verification/state machine: `src/verification/verification-model.js`, `verification.js`, `completion-gate.js` (`CLAIM → ACTION → OBSERVATION → EVIDENCE → VERIFIED`).
- Observation→evidence: `src/cognition/observation-engine.js`, `observation-provenance.js`.

### Config / tests / packaging
- Config loader: `src/config/wam-config.js`; feature flags live in `src/policy/`.
- Tests: `npm test` → `scripts/run-tests.mjs`; release gate `scripts/release-gate.mjs`; package verification `scripts/verify-package.mjs`; benchmarks in `benchmarks/`.
- Zero runtime dependencies today (packaging constraint for CHANGE 03).

## 4. Capability mapping (WAM need → CQE operation)

| WAM investigation need | CQE capability | Status |
|---|---|---|
| Locate definition of symbol | `runCQP('FIND definitions OF symbol X')` / `symbolLookup` (`index-ops.js:32`) | Covered |
| References / usages | `runCQP` reference ops | Covered (verify operator) |
| Lexical/text search | `lexicalLookup` (`index-ops.js:41`) | Covered |
| Dependency traversal between files | `dependencyExpand` (`index-ops.js:46`) | Covered |
| Locate relevant tests | lexical + path filters | Covered via query, no dedicated operator |
| Budget-limited selection | `engine/selector.js` + `CF_BUDGET` | Covered (needs per-call budget) |
| Provenance/evidence packet | `context-pack.js`, `evidence.js` | Covered |
| Repository isolation | none (global cwd + cache) | **GAP → CHANGE 02** |
| Per-call config/root | none | **GAP → CHANGE 02** |
| Typed errors / partial status | partial | Verify in CHANGE 02 |

## 5. Risks

1. **Global state / `process.cwd()`** — highest risk; blocks multi-repo and concurrent use.
2. **Missing `main`** — package cannot be imported by bare specifier until fixed.
3. **External binary drift** — missing `rg`/`fd`/`ast-grep` must surface as typed failure, never as empty results.
4. **Cache staleness** — TTL-only invalidation could present stale evidence as current; require fingerprint-based invalidation.
5. **Reimplementation drift** — WAM must route through the existing `context-source-registry`, not add a second retrieval path.

## 6. Gate decision

- CHANGE 01 acceptance criteria: **MET** (contract documented; reusable components identified; deps known; WAM behavior unchanged).
- CHANGE 02 is **viable but required**; it must deliver: importable factory `createEngine({root, budget, cacheDir})`, per-repo isolated cache/index, no module-scope side effects, typed errors, MCP re-pointed at the same core, and a valid `main`/`exports` entry.
- No npm publish or WAM dependency wiring until CHANGE 02 passes its isolation and compatibility tests.
