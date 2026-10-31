# Design: Zero-friction WAM (advisory instead of approval)

## Goal

WAM never asks the human to approve and never blocks a tool call for workflow reasons.
It states a recommendation in the injected context and gets out of the way.

## Invariant

> Advisory surfaces return `allowed: true` (or `blocked: false`) **and** a
> `recommendation` string. Blocking is reserved for irreversible/destructive effects and
> corrupt state.

## Research links

- OpenCode plugin hooks (`permission.ask`, `tool.execute.before`):
  https://opencode.ai/docs/plugins/
- OpenCode SDK (session/tool events): https://opencode.ai/docs/sdk
- Prior art in-repo: `openspec/changes/add-clarification-policy` (ask only when critical).
- `AGENTS.md` design rules: validate at trust boundaries; fail loud on corrupt state,
  fail soft on diagnostics. Friction removal applies to *diagnostics and workflow*,
  not to trust-boundary validation.

## Alternatives considered

### A. Config flag `friction: "none" | "normal"` (rejected as default)

Keeps two code paths and two test matrices; the default would still block. Also invites
silent divergence where tests pass in one mode and production runs the other.

### B. Delete the approval state machines entirely (rejected)

`contract.status`, `permissionPreflight.status` and the commands are part of the public
surface (docs, `/wam status`, web dashboard, persisted task state). Deleting them breaks
saved state and user muscle memory. Instead they become **informational**: transitions
happen automatically and commands are no-ops that report the advisory.

### C. Advisory-only, single path (chosen)

One code path, no new config. Blocking remains only where the effect is irreversible.

## Mapping (old → new)

| Surface | Old | New |
|---|---|---|
| `permission.ask` (index.js) | `ask` unless granted | `allow` |
| `delegationBlocked` | blocks delegation | `{ blocked:false, recommendation }` |
| `permissionPreflightLines` | "Aprobar: /wam permissions approve" | recommendation line |
| `governance-enforcement` | throws `WamPolicyBlock` | `{ allowed:true, recommendation }` |
| contract `PROPOSED` | waits for yes/no | auto-`APPROVED`, phase advances |
| `¿Apruebo este contrato?` | question | "Recomendación: contrato propuesto (N reqs) — procedo" |
| clarification gate (`ASKING`) | blocks mutating tools | advisory |
| discovery classifier (`enforce`) | throws | advisory |
| `completion-gate-simple` | `blocked:true` | `blocked:false, advisory:true` |
| runtime guards (stale/unverified/repeat-read/uncatalogued) | `allowed:false` | `allowed:true` + `recommendation` |
| N0 policy text | "autonomy loop \| soft-archive only (U1)" | "autonomy loop \| 0 friction: advisory only (U1)" |

## Preserved blockers (documented exclusion)

- `isHardDelete` / destructive-risk envelope (U1 soft-archive).
- Corrupt persisted state (JSON/schema) — fail loud.
- These are workspace-safety invariants, not approval friction.

## Recommendation channel

Recommendations reuse the existing notice path (`earlyNotices`, `nudge`, and the injected
`[wam N0 policy]` line) so they are visible but non-blocking, and deduplicated once per
state change to avoid log spam.

## Drawbacks / risks

- Agents may ignore recommendations → mitigate by stating the concrete next command.
- Tests that asserted blocking must be inverted; any consumer relying on `blocked:true`
  to *end* a loop now loops forever → audit call sites in `orchestration.js` and
  `index.js` before removing the throw.
