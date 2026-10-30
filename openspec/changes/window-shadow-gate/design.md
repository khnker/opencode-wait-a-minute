# Design: window-shadow-gate

## Context

`scripts/context-shadow-report.mjs` is a read-only promotion gate over
`.wam/context-shadow.jsonl`. It parses every line, counts availability, and
applies `mode`, `budget`, `delta` and `selection` checks. All checks currently
use the full record list, and `delta` reports the maximum ratio over that list.

Observed failure: `comparador-precios` has 10 records, 7 available. The two
records written after the projection fix are 0.97; one pre-fix record is 1.81.
The gate fails on the maximum, so the project can never promote without
mutating evidence.

## Goals

- Gate on current projection quality, not on historical defects.
- Keep historical telemetry intact and auditable.
- Keep `parse` fail-loud over the whole file.

## Non-Goals

- Pruning or rotating telemetry.
- Changing the record schema or the brief.
- Time-based filtering (no clock dependency in tests).

## Research

- Statistical process control evaluates a process by its current window of
  observations, not by every observation ever recorded (Montgomery, *Introduction
  to Statistical Quality Control*, control charts with moving windows).
- Rolling-window evaluation is the standard for SLOs/error budgets: a fixed
  window bounds both memory and staleness (Google SRE Workbook, "Alerting on
  SLOs").
- OpenSpec convention in this repo: gates are deterministic and read-only;
  evidence files are append-only.

## Alternatives Considered

1. **Max over all records (status quo)** — rejected: one historical defect
   blocks promotion permanently and pressures operators to delete evidence.
2. **`--since <timestamp>`** — rejected: couples the gate to wall-clock time,
   makes tests time-dependent, and requires knowing when the fix landed.
3. **Filter by `schemaVersion` or a new `codeVersion` field** — rejected: adds
   a producer-side field and a migration; a window needs no schema change and
   works on existing files.
4. **Prune/rotate telemetry before evaluating** — rejected: destroys the
   audit trail and hides regressions.
5. **Last N records of any kind** — rejected: trailing fallback/unknown records
   would shrink the evaluated set and mask the projection.

## Decisions

### Decision 1: Window over the last N available records

`evaluated = parsed.filter(projectionAvailable === true).slice(-N)`, with
`N = options.windowSize ?? minRecords` (default 20). Fallback and unknown
records never enter the window; they are still counted for visibility.

### Decision 2: All quality checks use the window

`mode`, `budget`, `delta`, `selection` and the token/id aggregates use the
window. `parse` uses the whole file. The `records` gate requires the window to
hold at least `--min-records` available records.

### Decision 3: `--window` is opt-in and validated

Positive integer; `--window 0` is rejected instead of silently evaluating
nothing (and `slice(-0)` would otherwise mean "all").

## Risks / Trade-offs

- A regression older than the window is invisible. Mitigated by the window
  defaulting to `--min-records` (20) and by keeping the file append-only.
- Pre-fix defects stay inside the window until N newer available records exist,
  so promotion still needs N clean recent records; the window prevents them
  from blocking *forever*, it does not waive the minimum.
- Aggregates (tokens, omitted ids) now describe the window, not the file; the
  report prints both total and evaluated counts.
