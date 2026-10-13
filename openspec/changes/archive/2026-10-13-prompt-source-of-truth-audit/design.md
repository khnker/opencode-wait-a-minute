# Design: Prompt Source-of-Truth Audit
## Scan Strategy
- Walk the repo root recursively for `*.js` and `*.mjs`.
- Exclude `node_modules`, `vendor`, `.git`, `openspec`, `dist`, `coverage`, `benchmarks/artifact-outcome`, the gitignored vendored `upstream/` clone, and any dot-directory (`.wam`, `.cqe`, `.tgrep`, ...).
- Read the catalog at `prompts/index.json` (resolved relative to the repo root via `import.meta.url`).
- Per file: one pass for `loadPrompt("<id>")` code references, one argument-aware pass for call constructs, and a line pass for property/`rules:`/`[wam N*]` heuristics. Files that fail to read are reported to stderr and skipped; the scan never throws.
## Classification
- `centralized` — the site routes through `loadPrompt("<id>")`.
- `deterministic` — a raw literal matching an explicit deterministic pattern: error-class prefix, `WAM_`/`ERR_` code, `log`/`error`/`warn` label, single identifier/dotted path, or pure interpolation with no natural-language tokens. The exact regexes are printed in the report.
- `candidate` — any other raw literal; a human reviews it. Candidates are NEVER auto-migrated.
## Report Format
- Default: Markdown to stdout with Summary counts, Registered-but-unused, Stale consumer refs, Duplicate candidates, Raw candidate sites grouped by file, and the Deterministic sites count.
- `--json`: the same data as a JSON object with deterministic ordering (sites sorted by path then line; ids sorted).
- `--strict`: exit 1 when there are orphan prompts, stale consumer refs, or duplicate candidates; otherwise always exit 0.
- `--out <path>`: optionally mirror the report to a file (gitignored under `prompts/audit-report.*`).
## Non-Goals
- No prompt migration, extraction, or mutation of source files.
- No AST/full-fidelity parsing; heuristics are line/argument based and intentionally conservative.
- No network access and no new runtime dependencies.
