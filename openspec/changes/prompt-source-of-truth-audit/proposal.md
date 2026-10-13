# Proposal: Prompt Source-of-Truth Audit
WAM surfaces model-directed strings (nudges, warnings, notices, injections and inline guidance) from many places. Some route through `prompts/index.json` + `loadPrompt`; others remain raw literals inside logic, where they silently drift from the catalog. Before any migration, we need a reproducible, read-only audit that inventories every model-directed site, cross-references it against the catalog, and separates genuine instruction candidates from legitimately deterministic strings (error messages, log labels, identifiers).
> Audit only. This change introduces a scanner and its report; it does NOT migrate, rewrite, or delete any prompt literal.
## Goals
1. Inventory every model-directed string site with file:line, its construct, and whether it routes through `loadPrompt`.
2. Cross-reference the catalog: registered prompts never used, consumer references that no longer resolve, and raw candidates that duplicate a registered prompt.
3. Classify each raw site as `centralized`, `candidate`, or `deterministic` using an explicit, documented heuristic.
4. Emit a deterministic (sorted) report, human-readable by default and JSON via `--json`, with a `--strict` exit code for CI.
5. Guarantee the audit is read-only and reproducible: same input tree, same output.
