# Design: WAM Audit Evidence Reports

## Approach

A renderer consumes the audit JSON (single source of truth) and produces deterministic Markdown, never re-reading `.wam` or the database. Default locations: per-project report at `<project>/.wam/audit/wam-behavior-report.md`, global index at `$WAM_AUDIT_HOME/index.md` (default `~/.local/share/wam/audit/index.md`), both overridable via flags.

Per-project report sections:

1. Header: project path, generation command, audit schema version.
2. Coverage: tasks matched/orphan, sessions matched/orphan, corrupt records.
3. Verdict summary: counts per axis (direction, completion, retry).
4. Per-task table: taskId, session id, direction, completion, retry, confidence.
5. Per-task detail: each verdict with cited evidence.
6. Methodology: heuristics and limitations.
7. Reproduction: exact command and inputs.

Evidence citations: `.wam` -> `path:line`; database -> `table#rowid` plus the query used. Every verdict MUST cite at least one source; verdicts without sources are rendered `UNKNOWN` with an explicit note.

Rendering is pure and ordered; identical JSON yields byte-identical Markdown. Secret-like values (tokens, keys, passwords) are redacted before rendering.

## Required scenarios

1. Full report containing all verdict types.
2. Partial report containing orphan tasks and sessions.
3. False-success highlighted with cited evidence.
4. Redaction of secret-like values.
5. Determinism: identical JSON -> identical Markdown.
6. Index aggregation across several projects.
7. Reproduction command documented and executable on a clean checkout.
