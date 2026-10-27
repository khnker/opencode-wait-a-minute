# Design: Fix runtime hygiene

## Logging
`logger._log` rotates `plugin.log` to `plugin.log.1` when it exceeds
`WAM_LOG_MAX_BYTES` (default 5 MB). `selectContext` rotates
`selection-log.jsonl` at 5 MB. `scripts/run-tests.mjs` spawns suites with
`WAM_DISABLE_LOGGING=1` and a `WAM_LOG_FILE` under the OS temp dir, so test
runs never grow the project log.

The repo also ships `.wam/config.json` with `logging: false`; users can opt in
with `WAM_LOGGING=true`.

## CQE telemetry
`recordExecution` in the vendored optimizer wraps the NDJSON append in
try/catch. Telemetry is diagnostic, never a precondition for a query.

## Skill matching
`scoreSkill` compiles a word-boundary regex for each keyword/capability/domain
term instead of `includes`. `arch` no longer matches `archivos`; whole-word
prompts still match.

## Contract synthesis
`splitPromptClauses` splits on sentence boundaries first. It only splits a
sentence on commas/`y`/`and` when every part starts with an action verb. The
requirement keeps the original verb instead of stripping it and re-prefixing.
No "Tarea completada según intención" / "Resultados verificables" fallback.

`nextActionFrom` only prefixes `Implementar` when the title does not already
start with a capitalized word, so `Implementar: X` stays as-is.

## Recent changes
`addRecentChange` keeps the header plus the newest 49 sections (50 total).

## Task aggregate
`loadTaskState` skips task files without a top-level `status` (live
phase-based schema) and still throws on an unrecognized non-empty status.
