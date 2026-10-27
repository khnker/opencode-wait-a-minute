# Proposal: Fix runtime hygiene

## Why

An audit of `.wam/` exposed several runtime defects:

- `.wam/plugin.log` reached **102 MB / 795k lines**, mostly `AuditSuccess` /
  `AuditPersist` entries. There is no rotation, and test runs write to the
  project's `.wam` because logging defaults to on.
- `.wam/traces/selection-log.jsonl` reached **19 MB** with no rotation.
- `cqe` always failed with `EACCES` on
  `vendor/context-query-core/src/telemetry.ndjson` (root-owned file), so CQE
  never contributed context.
- Skill routing used substring matching: `archivos` matched the keyword `arch`
  and selected `arch-linux-triage` / `breakdown-epic-arch`.
- Contract synthesis split prose on every comma and `y`, stripped the verb and
  prefixed `Implementar:`, producing requirements like `Archivos para ver...`
  and `Como corregirlo`. `nextActionFrom` then produced `Implementar
  Implementar: ...`.
- `recent-changes.md` had 1857 sections (2.9 MB) and grew without bound.
- `loadTaskState` treated phase-based live task files as corrupt because they
  have no top-level `status`, breaking aggregate reconciliation.

## What changes

- 5 MB rotation for `plugin.log` and `selection-log.jsonl`.
- Tests run with logging disabled and a tmp `WAM_LOG_FILE`.
- CQE telemetry writes are best-effort; an unwritable store never fails a query.
- Word-boundary skill matching.
- Sentence-based contract splitting, verb preservation, idempotent
  `nextActionFrom`, no generic requirement fallback.
- `recent-changes.md` capped at 50 sections.
- Runner aggregate skips phase-based live task files but still fails loud on a
  real unknown status.
