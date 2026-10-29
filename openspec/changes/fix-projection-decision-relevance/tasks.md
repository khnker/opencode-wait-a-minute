## 1. Decision selection

- [x] 1.1 Filter decisions by task scope (`task-…`/`ses-…` id markers) and
      project-wide fallback.
- [x] 1.2 Deduplicate by normalized text, most recent first.

## 2. Rendering

- [x] 2.1 Render pending obligations once (open items), not in execution state.
- [x] 2.2 Render retrieval handles as count + bounded base-ref sample.

## 3. Validation

- [x] 3.1 Unit tests for scope filtering, project-wide decisions, dedupe,
      ordering and bounded refs.
- [x] 3.2 Integration: semantic pipeline brief still carries reason, evidence
      and retrievable canonical facts.
- [x] 3.3 Real-data check: `comparador-precios` and `wait-a-minute-plugin`
      shadow ratios under 1.
- [x] 3.4 `openspec validate fix-projection-decision-relevance --strict`.
- [x] 3.5 `npm run build`.
