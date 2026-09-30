# Tasks: WAM Behavior Audit

## 1. CLI and discovery
- [x] 1.1 Add `scripts/wam-audit.mjs` entry point with `--root`, `--out`, `--project` flags.
- [x] 1.2 Implement `.wam` root discovery under `--root`.
- [x] 1.3 Scan archived tasks in `.wam/history/<YYYY-MM-DD>/<taskId>/`, mark them `archived:true`, and do not double-count against `.wam/tasks/`.
- [x] 1.4 Define deterministic exit codes and JSON summary on stdout.

## 2. WAM ingestion
- [x] 2.1 Parse `state.yaml` with tolerant error handling.
- [x] 2.2 Collect artifacts (`summary.md`, `recent-changes.md`, evidence, hypotheses, experiments).
- [x] 2.3 Record corrupt/missing records with reasons without aborting.

## 3. OpenCode DB ingestion
- [x] 3.1 Open the database read-only (`mode=ro&immutable=1`).
- [x] 3.2 Introspect tables/columns required for correlation.
- [x] 3.3 Extract projects, sessions and message/part summaries needed for analysis.

## 4. Correlation
- [x] 4.1 Implement exact suffix matching (`ses-<suffix>` <-> `session.id`).
- [x] 4.2 Implement project + time + title fallback matching.
- [x] 4.3 Emit orphans with reasons and per-match confidence.

## 5. Analysis
- [x] 5.1 Implement direction assessment with cited evidence.
- [x] 5.2 Implement completion assessment including false-success detection.
- [x] 5.3 Implement retry-until-objective assessment.

## 6. Output
- [x] 6.1 Emit per-project and aggregate JSON with stable ordering.
- [x] 6.2 Ensure byte-identical reruns over identical inputs.

## 7. Verification
- [x] 7.1 Implement all required design scenarios as tests.
- [x] 7.2 Verify read-only guarantee by hashing `.wam` and DB before/after.
- [x] 7.3 Verify corrupt-state tolerance and exit codes.