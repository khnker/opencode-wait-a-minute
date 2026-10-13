# Design: Prompt-Quality Benchmark

Deterministic, freezable prompt-quality benchmark. Two prompt sets
(**baseline** vs **candidate**) are evaluated against versioned
scenario suites; each scenario is classified
`IMPROVED | NO_CHANGE | REGRESSION | INCONCLUSIVE` with per-criterion,
per-severity evidence.

## Module map

```
benchmarks/quality/prompt-eval/
  schema.mjs        validators (validateSuite / validateScenario / validateDataset)
  snapshot.mjs      content hashing + frozen run records (hashContent / freezeRun)
  run.mjs           deterministic run record writer (runEvaluation / serializeReport)
  deterministic.mjs   deterministic criterion evaluators
  metrics.mjs         aggregation + severity weighting
  decision.mjs        IMPROVED|NO_CHANGE|REGRESSION|INCONCLUSIVE
  compare.mjs         frozen-snapshot comparison of two runs
  report.mjs          single-run + comparison reports (serializeReport)
  suites/*.json       versioned scenario fixtures (git-tracked)
  runs/<runId>/       local frozen run artifacts (git-ignored; only runs/.gitignore tracked)
  *.test.mjs        colocated tests (node:test)
```

## Interfaces (phase B implements against these)

### `schema.mjs` (this change)
- `validateSuite(suite)` / `validateScenario(scenario, { index?, suiteId? })`
  / `validateDataset(suites)`.
- Suite = `{ id, version, description?, scenarios: [Scenario] }`.
- Scenario = `{ id, suite, severity: critical|high|medium|low, context,
  promptRef (id into prompts/index.json), criteria: [Criterion], expectation }`.
- Criterion = `{ id, kind: must|must-not, required: boolean, check }`.
- Rejects duplicate scenario ids within a suite **and across the dataset**
  (explicit error naming both owning suites); rejects missing mandatory
  fields (never silently skipped). Throws `PromptEvalSchemaError`
  carrying an `errors` array.

### `snapshot.mjs`
- `hashContent(string) → string` — SHA-256 hex of the exact prompt body.
- `freezeRun({ suite, promptContents, config }) → FrozenRun` — immutable
  run record: per-prompt `{ id, path, hash }`, suite hash, config hash.
  Prompt CONTENT hashes are stored so later comparison uses the snapshot,
  never the live file.

### `run.mjs`
- `runEvaluation({ labels, suites, root?, outDir? }) → { runId, run, artifacts }`
  — executes the deterministic evaluation for each label (baseline/candidate),
  writes a versioned run record + JSON artifacts under
  `benchmarks/quality/prompt-eval/runs/<runId>/`.
- `serializeReport(report) → string` — stable serialization: identical
  input yields identical bytes.
- `invokedDirectly` — `process.argv[1] && import.meta.url ===
  pathToFileURL(process.argv[1]).href` gate, mirroring
  `benchmarks/artifact-outcome/index.mjs`.
- **runId derivation**: `label` + sorted content hashes — no timestamps,
  no durations inside the serialized core. Wall-clock lives only in an
  ignored sidecar (`runs/<runId>/wallclock.json`, gitignored) if needed.

### Evaluators (implemented)
- `deterministic.mjs`: pure criterion checkers over prompt text + scenario
  context; total functions, no I/O.
- `metrics.mjs`: severity-weighted aggregation over criterion results.
- `decision.mjs`: per-scenario classification into
  IMPROVED | NO_CHANGE | REGRESSION | INCONCLUSIVE.

## Determinism invariant
Two runs with the same inputs produce byte-identical
`run.json` / `report.json` cores. Sources of nondeterminism (clock,
map iteration order, float formatting) are excluded or canonicalized
(sorted keys, fixed-precision arithmetic).

## Runs layout
```
runs/<runId>/
  run.json        local frozen run record
  report.json     classified results
  wallclock.json  wall-clock only (written only with --write-wallclock)
```
`runs/` holds LOCAL execution snapshots and is git-ignored in full
(`runs/.gitignore`: `*` + `!.gitignore`); only the directory placeholder
is tracked, so the working tree stays clean across reruns. The schema
(`wam.prompt-eval.run/1`) is versioned and reviewable in source.

## Reuse (no duplication)
- Prompt content: `src/prompts/loader.js` (`loadPrompt`, `listPrompts`)
  + `prompts/index.json`. No second loader.
- CLI conventions: `scripts/prompts-check.mjs` (arg parsing, `--json`,
  exit codes).
- Deterministic entry pattern: `benchmarks/artifact-outcome/index.mjs`.
- No new npm deps; validators are hand-rolled.
