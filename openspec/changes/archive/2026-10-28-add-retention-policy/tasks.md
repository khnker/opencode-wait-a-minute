# Tasks: add-retention-policy

## 1. Spec

- [x] 1.1 Add `specs/retention-policy/spec.md` with ADDED requirements and scenarios.
- [x] 1.2 Record research links and rejected alternatives in `design.md`.

## 2. Implementation

- [x] 2.1 Add `src/context/retention-policy.js`.
- [x] 2.2 Import `RETENTION_POLICIES` and `RELATION_TYPES` from `context-normalization.js`.
- [x] 2.3 Implement `buildReferenceIndex`, `planRetention`, `applyRetentionPlan`.
- [x] 2.4 Keep the module pure: no disk writes, no input mutation.
- [x] 2.5 Do not wire into compaction, the hook, assembly, context, or retention-manager.

## 3. Tests

- [x] 3.1 Add `src/context/retention-policy.test.mjs`.
- [x] 3.2 Cover active/durable, archivable, ephemeral, live references,
  sole evidence, multiple evidence, dead claims, `canDiscard`, determinism,
  immutability, dangling targets and cycles.

## 4. Validation

- [ ] 4.1 `node --test --test-force-exit src/context/retention-policy.test.mjs`
- [ ] 4.2 Existing retention-manager / context-freshness / context-compaction tests
- [ ] 4.3 `openspec validate --changes --strict`
- [ ] 4.4 `npm run build`

## 5. Follow-up (out of scope)

- [ ] 5.1 Adopt the planner in the projection phase.
- [ ] 5.2 Decide whether compaction's score-based pruning should delegate here.
