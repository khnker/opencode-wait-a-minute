# Context Pack Evidence — Design

## Research

- OpenTelemetry GenAI semantic conventions (`gen_ai.*`) for recording per-request
  model input: one record per request, immutable, with request id and usage.
  https://opentelemetry.io/docs/specs/semconv/gen-ai/
- W3C PROV / append-only ledger practice: a monotonically numbered sequence plus
  a manifest makes order and completeness auditable without a database.
- Node `fs` atomic-write guidance (`mkdtemp` + `rename`) — rejected: a single
  small JSON per turn with a best-effort write is enough; evidence must never
  break prompt injection.

## Alternatives considered

| Option | Verdict |
|---|---|
| Extend `.wam/traces/<traceId>.json` | Rejected: traces are keyed by random trace id, have no total order and coalesce batched writes. |
| Append one JSONL file per task | Rejected: a partial trailing write corrupts the last record and there is no cheap per-turn lookup. |
| One numbered JSON file per turn + `index.json` manifest | **Chosen**: total order from the zero-padded sequence, per-turn isolation, trivially inspectable. |

## Layout

```
.wam/tasks/<taskId>/context/
  0001-<promptHash>.json   # first turn
  0002-<promptHash>.json   # second turn
  index.json               # ordered manifest (entries sorted by seq)
```

Record shape:

```json
{
  "seq": 1,
  "createdAt": "2026-10-27T18:00:00.000Z",
  "taskId": "task-…",
  "prompt": "…",
  "promptHash": "…",
  "source": "router",
  "budget": 16000,
  "budget_used": 5973,
  "budget_violation": false,
  "levels": { "N0": 2, "N1": 3, "N2": 1, "N3": 4 },
  "injected": ["…"],
  "candidates": [{ "id": "…", "type": "…", "content": "…", "verified": false }],
  "dropped": ["admission: dropped N3 (OPTIONAL) — …"],
  "integrity": { "selectedCount": 9, "emittedCount": 9, "omittedCount": 0, "finalSufficiency": "sufficient" },
  "rationale": ["…"]
}
```

## Decisions

- `candidates` is taken from `graph.getNodes()` before selection, so the archive
  holds the full pre-selection context; dropped reasons reference node ids.

- `seq` is derived from the highest existing file number, so a missing/corrupt
  manifest cannot cause a collision.
- Ordering is the numeric file name; `index.json` mirrors it and includes
  `lines`, `dropped` and `violation` counters for quick audits.
- `WAM_CONTEXT_EVIDENCE_MAX` (default 500) bounds growth; oldest records are
  pruned first.
- Every failure is swallowed and returned as `{ok:false, reason}` — evidence
  collection must not break message handling.
