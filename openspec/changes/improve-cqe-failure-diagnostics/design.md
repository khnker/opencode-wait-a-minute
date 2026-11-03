# Design: Improve CQE failure diagnostics and outcome accounting

## Research

- Node.js `Worker` lifecycle and `unref()` / message error surfaces:
  https://nodejs.org/api/worker_threads.html
- Error cause classification via stable string codes (avoids brittle stack
  parsing): https://nodejs.org/api/errors.html#errorcause
- OpenTelemetry semantic conventions for error type/status, used as the naming
  inspiration for stable `failureCode` values:
  https://opentelemetry.io/docs/specs/semconv/general/events/

## Alternatives evaluated

1. **Parse stack traces / expose raw `cqeError` in the prompt (rejected).**
   Raw messages vary by environment, can leak paths, and are not stable for
   tests or user guidance.
2. **Only add logging behind `WAM_LOGGING` (rejected).**
   Logging is opt-in and disabled in this repo (`.wam/config.json`), so it does
   not address the user-visible symptom or make the outcome verifiable.
3. **Stable failure codes + actionable prompt hint + bounded task counters
   (chosen).** Deterministic, testable, works with logging disabled, keeps the
   prompt small, and provides the evidence needed to verify the outcome.

## Design

`classifyCqeFailure(err, { timedOut, fallbackReason })` returns a stable code
with a deterministic precedence:

1. `fallbackReason` when it is one of `busy`, `warming`, `empty`, `timeout`.
2. `timedOut` or `CQE_TIMEOUT` in the message → `timeout`.
3. `CQE_ROOT_NOT_FOUND` → `root-not-found`.
4. `CQE_ENGINE_UNAVAILABLE` → `engine-unavailable`.
5. module resolution errors (`ERR_MODULE_NOT_FOUND`, `Cannot find module`,
   `import`) → `import-failed`.
6. anything else → `error`.

`CQE_FAILURE_HINTS` maps each code to a short Spanish hint shown in the
injected line. `cqeMeta` carries `failureCode`, `failureHint` and `empty`.
`cqeStats` is a bounded object `{ calls, ok, empty, error, timeout, busy,
warming, other }` incremented once per CQE call; no unbounded lists are kept.

Backward compatibility: `fallbackReason` keeps its existing values (`error`,
`empty`, `busy`, `warming`) because integration tests assert them.
