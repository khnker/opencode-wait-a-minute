# Proposal: Align preflight docs with the advisory contract

## Why

`zero-friction-advisory` made the permission preflight advisory: `delegationBlocked()` in
`src/policy/permission-preflight.js` always returns `blocked: false` and, while the plan is
pending, adds a `recommendation` string instead of withholding delegation. `README.md:165`
still advertised the old behaviour ("blocks delegation until they are granted"), so the
documented contract contradicts the code and invites users to wait for a gate that no
longer exists.

## What changes

- `README.md` "Runtime controls" bullet: the preflight surfaces the derived permissions as
  a recommendation, delegation is never blocked, and `/wam permissions approve` / `deny`
  only update the recorded plan (`/wam status` shows it).
- That bullet stays the single in-repo description of the preflight. No code change.

## Out of scope

- Any change to `src/policy/permission-preflight.js` or the `/wam permissions` commands.
- Removing the preflight: it stays as visibility, not as a gate.
- Files outside the repo (generated `dist/`, local `.wam/` state).

## Research

In-repo sources read for this change:

- `openspec/changes/zero-friction-advisory/proposal.md` — "No approval state gates
  execution ... `permission.ask` returns `allow`".
- `openspec/changes/zero-friction-advisory/specs/` — preflight must not return a blocking
  decision for workflow reasons.
- `src/policy/permission-preflight.js` — `delegationBlocked()` returns `{ blocked: false }`
  plus `recommendation`.
- `README.md` "Runtime controls" list, the drifted line.
