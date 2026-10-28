# Design: Context item semantic contract

## Research

- W3C PROV-DM — provenance model (entities, activities, agents, derivations):
  https://www.w3.org/TR/prov-dm/
- W3C PROV-O — OWL encoding of the provenance model:
  https://www.w3.org/TR/prov-o/
- Martin Fowler — Event Sourcing (append-only facts, status as a projection):
  https://martinfowler.com/eaaDev/EventSourcing.html
- W3C PROV Constraints (validity, impossibility of derivation cycles):
  https://www.w3.org/TR/prov-constraints/

The model borrows two ideas and deliberately leaves the rest for later phases:

1. An item needs a stable identity, a kind, and explicit provenance references
   (`sourceRefs`, `relations`) rather than a single opaque `source` label.
2. Lifecycle is data, not deletion: `status` and `retention` describe what the
   item means now, matching event sourcing's "append, then project" stance.

## Model

```
ContextItem = {
  // legacy fields, preserved verbatim in shape and meaning
  id, content, source, type, timestamp, scope, relatedRequirements, metadata,
  // semantic contract
  kind,        // CONTEXT_KINDS
  status,      // CONTEXT_STATUSES
  retention,   // RETENTION_POLICIES
  sourceRefs,  // string[]
  relations,   // { type: RELATION_TYPES, targetId: string }[]
  scopeType,   // CONTEXT_SCOPE_TYPES
  scopeId,     // non-empty string
}
```

`scope` remains the legacy string so existing readers (for example
`context-interception.js` filtering on `item.scope`) keep working. The contract
adds `scopeType`/`scopeId`; `validateContextItem` also accepts an object
`scope = { type, id }` for new producers.

### Enum mapping, not duplication

- `CONTEXT_KINDS` is exactly the classification module's category list
  (`FACT | OBSERVATION | CLAIM | ASSUMPTION | DECISION | REQUIREMENT | EVIDENCE |
  ERROR | ACTION | RESULT`), copied verbatim so the item does not import a second
  vocabulary. `context-classification.js` remains the classifier; normalization
  only stores its result in `kind`.
- `CONTEXT_SCOPE_TYPES` is the persisted projection of `context-scope.js`'s seven
  scopes: `PROJECT`/`GLOBAL` → `project`, `TASK`/`REQUIREMENT`/`ACTION` → `task`,
  `SESSION`/`TURN` → `session`. `group` is new and only reachable through an
  explicit scope object. The mapping is lossy by design: the seven scopes describe
  visibility layers, the four types describe durable ownership buckets.
- `CONTEXT_STATUSES = proposed | accepted | rejected | active | superseded |
  invalidated`. Justification: `proposed`/`accepted`/`rejected` cover claims and
  decisions under review; `active` is the safe default for captured items that
  were never reviewed; `superseded`/`invalidated` express invalidation without
  deleting history (event-sourcing projection). `draft` and `archived` are
  rejected because they describe retention, not validity.
- `RELATION_TYPES = derived_from | supports | contradicts | supersedes |
  depends_on`. Small enough to validate exhaustively; `derived_from` mirrors
  PROV's `wasDerivedFrom`, the other four cover the claim/decision graph.

### Defaults (deterministic, idempotent)

| field | default |
|---|---|
| `kind` | explicit `kind`, then `metadata.kind`, then `classifyContextItem(...)`, then `FACT` |
| `status` | `active` |
| `retention` | per kind: FACT/DECISION/REQUIREMENT/EVIDENCE `durable`; OBSERVATION/CLAIM/ASSUMPTION `archivable`; ERROR/ACTION/RESULT `active` |
| `sourceRefs` | `[]` unless an array of non-empty strings is supplied |
| `relations` | `[]`; malformed/duplicate entries dropped |
| `scopeType` | explicit, else mapped from `normalizeScope(scope)`, else `session` |
| `scopeId` | explicit id, metadata ids, else the item id (never empty) |

Idempotency follows because every default is derived from a field the first pass
already wrote (`kind`, `scopeType`, `scopeId`, `retention`, arrays).

## Alternatives considered

### A. New `src/context/context-item.js` subsystem

Rejected. It would create a second normalization entry point next to the one
every capture path already calls, and the enums would be imported by both. The
extra seam buys nothing until a second implementation exists; the deletion test
fails (deleting it moves nothing — the logic would immediately reappear in
normalization).

### B. Store the contract in the persistence schema

Rejected for phase 1. Persistence schemas are versioned and migrated; putting
the vocabulary there forces a migration before any consumer exists, and it
couples the in-memory contract to storage format. The schema can derive columns
from the enums later; not the reverse.

### Chosen: extend `context-normalization.js` in place

Smallest complete diff: the module already owns item shape, is already called by
every capture path, and already imports nothing that would cycle with
classification or scope. Enums are frozen exports, validation is a pure
function, and legacy behavior is preserved.

## Risks

- `scopeId` falling back to the item id means items without a real owner look
  scoped. Documented; phase 2 should treat `scopeId === id` as "unowned".
- `GLOBAL` collapsing to `project` is lossy. A future contract can add a `global`
  scope type without breaking stored items.
- Classification is keyword-based, so legacy `kind` defaults inherit its
  confidence. Explicit `kind` always wins.
