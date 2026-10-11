# Proposal: WAM Audit Evidence Reports

## Intent

Turn the audit results into reviewable, traceable and reproducible Markdown evidence: one report per project plus a global index, so conclusions about direction, completion and retry can be inspected and defended.

## Scope

- Define the per-project report schema and the global index schema.
- Render reports from the `wam-behavior-audit` JSON output only.
- Evidence citation format (`.wam` path:line; database table plus row identifier).
- Coverage and orphan transparency.
- Secret redaction.
- Documented reproduction command.

## Non-goals

- No new analysis beyond change `wam-behavior-audit`.
- No runtime changes.
- No editing of source repositories other than writing reports to the configured audit root.
