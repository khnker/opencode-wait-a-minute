# Proposal: Prefer native file tools over shell grep/sed

## Problem

WAM's runtime discovery guidance still pushes agents toward shell `grep` and
`sed`:

- `nudge.discovery.grep` recommends a "dedicated 'grep' tool" but keeps the
  ambiguous word `grep` and never names a concrete fallback.
- `nudge.discovery.default` lists only `grep`, `glob` and `read`.
- `sed`, `awk`, `cat`, `head` and `tail` are treated as valid read-only
  discovery, and `sed -i` is classified as `justified` without any nudge, so
  in-place shell edits are silently accepted.
- `prompts/policies/discovery.md` still says
  "Preferir búsquedas indexadas (tgrep, grep, glob)".

The result is unnecessary shell file access when native tools (`Read`, `Grep`,
`Glob`, `Edit`/`Write`) already cover the same operations with structured
results, line numbers and atomic edits.

## Change

- Reword the discovery nudges to name native tools explicitly
  (`Read`, `Grep`, `Glob`, `Edit`/`Write`).
- Add `nudge.discovery.edit` for `sed -i` and `awk` writes.
- Keep `tgrep` (https://github.com/microsoft/tgrep) as the documented
  secondary content-search fallback, behind native `Grep`.
- Tag shell edits in `classifyBash` and route them to the edit nudge while
  preserving the existing `kind: "justified"` contract.
- Align `policy.discovery.rules` wording with native-first guidance.

## Out of scope

- Wiring the discovery policy into the always-on policy set (it is defined but
  currently unused).
- Changing classification of build runners, git commands or other justified
  mutations.
- Installing, bundling or depending on `tgrep` at runtime.
