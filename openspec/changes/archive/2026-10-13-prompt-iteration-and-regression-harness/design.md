# Design: Prompt Iteration and Regression Harness
## Fixtures
Each registered prompt id gets a fixture at `prompts/fixtures/<slug>.json` where `slug = id.replaceAll(".", "__")` (e.g. `notice.pending_task` → `notice__pending_task.json`). One flat directory keeps slug→id reversible and lookup trivial.
Fixture schema:
```json
{
  "id": "notice.pending_task",
  "vars": { "active": "task-1", "phase": "RUNNING" },
  "mustContain": ["tarea pendiente: task-1", "no asumo intención"],
  "mustNotContain": []
}
```
- `vars` are concrete, deterministic interpolation values. Prompts without `{{vars}}` use `{}`.
- `mustContain` are stable substrings that encode the prompt's core restriction/semantics (derived from the current body after rendering the fixture vars).
- `mustNotContain` captures forbidden content (empty unless a prompt forbids a token).
A test enforces 100% coverage: every catalog id has a fixture; missing ids are listed and fail.
## Rendering Capture
The harness renders the exact string a consumer receives. The base render is produced by `loadPrompt(id, vars, { root })` from `src/prompts/loader.js` so it is byte-identical to runtime. The candidate render applies the same `{{name}}` interpolation regex (`/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g`, mirroring the loader) to the candidate Markdown body (frontmatter stripped via `parseFrontmatter`). Both renders use the same fixture `vars`; a missing variable raises the same diagnostic the loader raises.
## Comparison Metrics
For each id the harness reports:
- `changed` — base render differs from candidate render, plus a unified diff.
- `tokensBase` / `tokensCandidate` / `tokensDelta` — via a self-contained `chars/4` estimator. `estimateTokens` from `src/skills/engine.js` is NOT reused because importing that module triggers side effects (logger, tmpdir, policy facades) and top-level `await`; the harness must stay offline and side-effect free.
- `placeholdersBase` / `placeholdersCandidate` — the placeholder name sets of each body; parity requires set equality.
- `restrictionIntegrity` — every `mustContain` present in the candidate render (with a list of missing) and every `mustNotContain` absent (with a list of offenders).
- `preserved` — candidate render is non-empty and keeps every base placeholder.
- `verdict` — `unchanged` when renders are identical; otherwise `accept` only if `placeholdersMatch && restrictionIntegrity.ok`, else `reject`. Token delta is reported but NEVER flips the verdict.
## Deterministic vs Real-Model
Deterministic local checks (rendering, diff, tokens, placeholder parity, restriction integrity) run by default, offline, and are the only behaviour the tests and CI depend on. Real-model evaluation (`--eval`) is opt-in: when selected the harness prints `real-model evaluation not configured; skipped` and performs no network I/O. Real-model scoring is deliberately unimplemented here so the deterministic layer stays reproducible.
## Non-Goals
- Automatic prompt rewriting or acceptance on token savings alone.
- Tokenizer integration (a documented chars/4 proxy is sufficient for relative deltas).
- Wiring the harness into the release gate — it is a developer tool; deterministic tests are enough.
- Real-model provider configuration or network calls.
