# Tasks: Zero-friction WAM (advisory instead of approval)

## Policy modules

- [x] `src/policy/permission-preflight.js`: `decidePermission` → `allow`; `delegationBlocked` → `blocked:false` + recommendation; `permissionPreflightLines` → recommendation (no "Aprobar/Denegar").
- [x] `src/policy/governance-enforcement.js`: contract-not-approved → `{ allowed:true, recommendation }` instead of `throw WamPolicyBlock`.
- [x] `src/verification/completion-gate-simple.js`: `blocked:false`, `advisory:true`, `unresolvedRequirements`, `recommendation`.
- [x] `src/execution/runtime-guards.js`: stale buffer, unverified hypothesis, repeated read, uncatalogued tool → advisory; keep hard-delete/destructive block.

## Contract lifecycle

- [x] `src/verification/contract.js`: `createContract` returns `APPROVED` by default (keep `PROPOSED` reachable via explicit edit/flag).
- [x] `src/integration/orchestration.js`: remove the "¿Apruebo este contrato?" notice; replace with one recommendation line; never gate on `contract.status`.
- [x] `src/integration/message-handler.js`: remove yes/no auto-approval/rejection branches; keep recommendation notices.
- [x] `index.js`: auto-approve on task creation; `/wam contract approve|reject` remain as explicit, non-blocking commands.

## Hooks and injected text

- [x] `index.js` `permission.ask`: always `allow`.
- [x] `index.js` delegation preflight call site: never block; inject recommendation.
- [x] `index.js` clarification gate (`ASKING`): advisory only.
- [x] `index.js` discovery classifier `WAM_READ_DELEGATION=enforce`: remove the throw path.
- [x] `index.js` `presentValidation`: always `continue` (never `validation-pending`).
- [x] `src/context/assembly.js` N0 policy line: "0 friction: advisory only".
- [x] `index.js` active-intervention header: recommendation framing, no approval wording.

## Tests and validation

- [x] Invert/extend unit tests: `permission.ask === "allow"`, `delegationBlocked().blocked === false`, governance returns advisory, completion gate advisory.
- [x] Add regression test: no injected text contains "Apruebo" / "Responde sí".
- [x] Update `test/test-completion-gate-false-positives.js` expectations.
- [x] `openspec validate --changes --strict`, `npm run build`, load-check `dist/`, `node scripts/run-tests.mjs`.
