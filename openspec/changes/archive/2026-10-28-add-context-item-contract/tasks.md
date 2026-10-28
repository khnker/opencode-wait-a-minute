# Tasks: Context item semantic contract

## 1. Contract

- [ ] 1.1 Export frozen `CONTEXT_KINDS` matching the classification categories.
- [ ] 1.2 Export frozen `CONTEXT_SCOPE_TYPES`, `CONTEXT_STATUSES`,
      `RETENTION_POLICIES`, `RELATION_TYPES`.
- [ ] 1.3 Document the `SCOPES` → `CONTEXT_SCOPE_TYPES` mapping in `design.md`.

## 2. Normalization

- [ ] 2.1 Add `kind` (explicit → metadata → classifier → `FACT`).
- [ ] 2.2 Add `status`, `retention`, `sourceRefs`, `relations`, `scopeType`,
      `scopeId` with deterministic defaults.
- [ ] 2.3 Preserve every existing field and the current `scope` string shape.
- [ ] 2.4 Export `normalizeItem` as an alias of `normalizeContextItem`.
- [ ] 2.5 Verify normalization is idempotent.

## 3. Validation

- [ ] 3.1 Add `validateContextItem(item)` returning `{ ok, errors }` without
      throwing.
- [ ] 3.2 Reject unknown `kind`, `status`, `retention`, `scope.type`, malformed
      `sourceRefs` and `relations`.
- [ ] 3.3 Fail soft for `null`, `undefined` and non-object input.

## 4. Tests

- [ ] 4.1 Add `src/context/context-normalization.test.mjs`.
- [ ] 4.2 Cover every enum rejection, missing/empty scope, malformed arrays,
      legacy defaults and idempotency.
- [ ] 4.3 Run `node --test --test-force-exit
      src/context/context-normalization.test.mjs`.

## 5. Validation gate

- [ ] 5.1 Run `openspec validate --changes --strict`.
- [ ] 5.2 Run `npm run build`.
- [ ] 5.3 Confirm the compaction hook, `context-compaction.js` and the Context
      Router are untouched.
