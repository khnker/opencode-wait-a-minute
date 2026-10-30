# Design: Align preflight docs with the advisory contract

## Invariant

Every in-repo surface describing the permission preflight must state the advisory
contract: the result is `allowed: true` / `blocked: false` plus a `recommendation` string.
Delegation is never withheld.

## Alternatives considered

### A. Keep the old wording and restore the blocking gate in code (rejected)

Contradicts `zero-friction-advisory`, whose spec forbids returning a blocking decision
from the delegation preflight for workflow reasons, and re-introduces the
`/wam permissions approve` checkpoint the user did not ask for.

### B. Delete the preflight entirely (rejected)

Loses visibility: the derived permission set still feeds `/wam status` and the
orchestrator's recommendation. Removing it leaves dead state in persisted tasks and drops
a useful signal — a larger cost than keeping one documentation bullet accurate.

### C. Fix the documentation, keep the advisory preflight (chosen)

Smallest complete diff: one README bullet. The code already implements the contract; only
the prose was stale.

## Risks

- Prose can drift again. Mitigation: the new wording names the observable behaviour
  (delegation is never blocked, result is a recommendation), so a future contradiction is
  greppable.

## References

- `openspec/changes/zero-friction-advisory/proposal.md`
- `src/policy/permission-preflight.js`
- `README.md`
