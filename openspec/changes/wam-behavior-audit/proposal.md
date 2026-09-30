# Proposal: WAM Behavior Audit

## Intent

Provide a read-only, reproducible cross-source audit of how WAM behaves across every project on the machine, by correlating `.wam` task state with the OpenCode persistence database. For each task it must answer three questions: (1) was the chosen direction consistent with the originating objective, (2) did execution actually complete, (3) did WAM retry until the objective was met.

## Scope

- Discovery of all `.wam` roots under a configurable root (default `/home/nicolas/dev`).
- Read-only ingestion of `.wam/tasks/<id>/state.yaml` and task artifacts.
- Read-only ingestion of the OpenCode SQLite database (`project`, `session`, `message`, `part`, `session_message`, and related tables).
- Correlation between WAM tasks and OpenCode sessions with explicit match method and confidence.
- Three-axis analysis: direction, completion, retry.
- Deterministic machine-readable output (per-project and aggregate JSON) plus a CLI.

## Non-goals

- No mutation of `.wam` state, task artifacts, or the OpenCode database.
- No automatic remediation of detected problems.
- No LLM/semantic scoring in v1; analysis is heuristic plus extracted evidence.
- No change to WAM runtime behavior.
