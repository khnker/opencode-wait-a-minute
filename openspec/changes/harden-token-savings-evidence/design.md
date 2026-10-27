# Design: Harden token-savings evidence

## Research
- Provider usage vs estimates: OpenAI tokenizer guidance (1 token ≈ 4 chars for
  English, worse for non-English/code) — https://platform.openai.com/tokenizer
- Existing spec: `openspec/specs/token-savings-benchmark/spec.md` (provider usage
  is authoritative; estimates must be labeled).
- Code: `src/verification/token-savings-meter.js`, `src/context/assembly.js:623-628`.

## Decision
1. `estimateTokens` keeps the deterministic `chars/4` heuristic (zero deps) but
   accepts `charsPerToken` so callers can calibrate. Every record stores
   `estimator: "chars/4"`.
2. `recordTokenSavings` starts the baseline at `null`. A baseline is only
   `measured` when the caller passes `baselineTokens` (env
   `WAM_BASELINE_TOKENS` or a captured baseline). Synthetic multipliers are
   never used to claim a percentage.
3. `savingsPct` is `null` and `savingsTokens` is `0` for synthetic records;
   `deltaTokens` keeps the raw (possibly negative) difference.
4. Stop passing the assembled output as `historyTokens` from `assembly.js`.
5. Rotate `token-savings.json` to the last `maxRecords` (default 1000) with an
   atomic tmp+rename write. Dropped records are appended to
   `token-savings-archive.jsonl` first; if the archive write fails, the metrics
   file stays unbounded instead of losing data.

6. **Provider usage**: an `event` hook captures `tokens.input +
tokens.cache.read` from assistant `message.updated`/`step-finish` into
`src/verification/request-usage.js` (bounded, 500 sessions). A claim requires
both a measured baseline and provider usage; otherwise `claimable: false`.

## Alternatives considered
- **Add a real tokenizer** (`js-tiktoken`): rejected as a new required
  dependency; the repo rule is deterministic fallbacks first, and the meter is
  not on the request path.
- **Keep the 30× baseline but label it**: rejected; a labeled lie is still
  reported by `printTokenSavingsSummary` and consumed by tests.
- **Delete the meter**: rejected; measured baselines are still useful when a
  benchmark supplies them.

## Test isolation
`WAM_METRICS_DIR` overrides the metrics directory. `scripts/run-tests.mjs`
sets it to the OS temp dir so suites never rewrite the project `.wam`.

## Risks
- Existing records without `baselineSource` are treated as unmeasured on read.
- Savings dashboards will show `null` until a measured baseline is configured;
  that is the intended behavior.
