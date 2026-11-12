# Tasks: explicit contract approval

- [x] 1. `projectState` emits `contract.status: "PROPOSED"` and drop the
  "nunca gatea aprobación humana" comment.
- [x] 2. `buildPersistedState` always persists new contracts as `PROPOSED` with
  the review `nextAction`; remove the `requireApproval`/`trivial` branch.
- [x] 3. Remove `applyBootstrapApproval`/`isBootstrapRoot` from
  `src/context/context.js` and the `index.js` import.
- [x] 4. Remove the obsolete bootstrap unit tests and keep root identity tests.
- [x] 5. Add regressions: new contract stays `PROPOSED` in advisory config;
  existing `APPROVED` preserved; `/wam contract approve` still approves.
- [x] 6. Run affected suites and `openspec validate --changes --strict`.
- [x] 7. Fresh-session `opencode web` verification (`npm run verify:web`);
  orchestrator fills the evidence in `verification.md`.
- [x] 8. Run `npm run build`.
