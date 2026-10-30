# Tasks: Align preflight docs with the advisory contract

## Documentation

- [x] Rewrite the `README.md` "Runtime controls" permission-preflight bullet: advisory
      recommendation, delegation never blocked, approve/deny only update the plan.
- [x] Grep `README.md`, `docs/`, `prompts/`, `skills/` and `src/` for remaining claims that
      the preflight blocks delegation (`blocks delegation`, `bloquea la delegación`,
      `permission preflight`). Only `README.md:165` carried the stale claim;
      `docs/OPENCODE_COMPATIBILITY.md` ("auto-allows access permissions already granted by
      the task's permission preflight plan") is compatible with the advisory contract.

## Tests and validation

- [x] No behavioural test applies: this change touches prose only and adding a test that
      asserts documentation wording would pin copy without protecting behaviour. The
      behaviour is already covered by `src/policy/permission-preflight.test.mjs`.
- [x] `npx openspec validate --changes --strict`.
- [x] `npm run build` and load-check `dist/`.
