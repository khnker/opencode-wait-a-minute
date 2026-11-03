# Proposal: Improve CQE failure diagnostics and outcome accounting

## Problem

Users report that CQE "fails a lot" in WAM. Repository evidence shows two
distinct issues behind that perception:

1. The injected line is identical for genuine empty results and hard failures:
   `[wam cqe] sin resultados (<reason>) en Nms — contexto nativo prevalece`.
   `fallbackReason: 'error'` takes precedence over the real error message, so
   the common symptom (`sin resultados (error)`) carries no actionable cause.
2. Only a single `cqeCalls` counter is persisted. There is no outcome
   breakdown (ok / empty / timeout / busy / warming / error), so the failure
   rate cannot be measured or verified.

## Change

- Add a stable failure classifier in `src/context/cqe-adapter.js`
  (`classifyCqeFailure`) that maps errors and fallback states to codes such as
  `timeout`, `root-not-found`, `engine-unavailable`, `import-failed`, `busy`,
  `warming`, `empty`, `error`.
- Propagate `failureCode`, `failureHint` and `empty` through
  `selectContextWithCqe` into `cqeMeta`.
- In `src/integration/message-handler.js`, emit an actionable injected line
  that distinguishes empty results from failures and includes the code and a
  short hint.
- Persist a bounded `cqeStats` breakdown on the task state next to the existing
  `cqeCalls` counter.

## Out of scope

- Changing the default CQE mode or index warm-up strategy.
- Persisting metrics outside task state.
