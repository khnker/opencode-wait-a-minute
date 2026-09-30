# WAM Audit Regression Gate

## Intent

Make the WAM behavior audit fail as a regression gate when recurrence indicators (NO_STRATEGY ratio, LOOPED_NO_PROGRESS, ambiguous matches) exceed thresholds or worsen vs a baseline.

The gate exists so CI and local runs can treat recurrence as a hard failure rather than a report-only observation. Running `scripts/wam-audit.mjs --gate` MUST exit `2` when any configured threshold is violated or when selected totals worsen against a baseline file, and exit `0` when the run is clean.

## Scope

- Gate mode (`--gate`) that evaluates current audit totals against configurable thresholds and optional baseline comparison.
- Config loading from `--config FILE` or `.wam-audit.config.json` in the cwd, with documented defaults.
- Baseline comparison (`--baseline FILE`) for NO_STRATEGY, LOOPED_NO_PROGRESS, RETRIED_AND_FAILED, and ambiguousMatches.
- Machine-readable `gate: { passed, violations }` in the aggregate JSON.
- Audit remains strictly read-only: no writes to `.wam` state or the OpenCode database.

## Non-goals

- Changing default (non-`--gate`) audit behavior or exit codes.
- Mutating `.wam` task state, history archives, or the OpenCode database.
- Defining or changing how recurrence indicators are classified (that belongs to `wam-behavior-audit`).
- Replacing the existing JSON/Markdown report formats.
- Shipping a hosted dashboard or trend store; the baseline is a local file.
