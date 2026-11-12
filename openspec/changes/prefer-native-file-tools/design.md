# Design: Prefer native file tools over shell grep/sed

## Research

- OpenCode tool catalog (`read` with `offset`/`limit`, plus `grep`, `glob` and
  the editing tools): https://opencode.ai/docs/tools/
- `tgrep` — trigram-indexed grep with a client/server architecture for fast
  regex search in large codebases, usable as a local search fallback:
  https://github.com/microsoft/tgrep
- Existing WAM discovery contract: `src/policy/discovery-classifier.js`,
  `prompts/nudges/discovery-*.md`, `prompts/policies/discovery.md`.

## Alternatives

1. **Native-first nudges + `tgrep` secondary fallback (chosen).** Keep the
   existing nudge mechanism, but name native tools, add an edit nudge and
   document `tgrep` after `Grep`. Smallest behaviour change
   that directly addresses the reported grep/sed overuse.
2. **Only reword the policy hint (rejected).** Leaves the `grep`/`sed`
   classification and the missing edit guidance untouched, so the behaviour does
   not change.
3. **Hard-block shell `grep`/`sed` in the classifier (rejected).** Produces
   false positives for legitimate read-only pipelines (`grep x | wc -l`) and has
   no native equivalent for some operations; the existing classifier is
   intentionally advisory.
4. **Enable the discovery policy as always-on (deferred).** Wiring
   `PERSISTENT_POLICIES.discovery` changes prompt content for every session, a
   broader blast radius than needed for this fix. The policy text is corrected
   now so the future wiring is safe.

## Decisions

- Keep `classifyBash` returning `kind: "read-only" | "justified"`; add an
  optional `shellEdit: true` flag on the selected-edit branches. This preserves
  every existing consumer and test while letting `nudgeFor` produce an edit
  nudge for `sed -i`/`awk` writes.
- `nudgeFor` continues to return `null` for unrelated justified commands
  (`npm test`, `git commit`, ...), so the new edit nudge cannot fire for build
  or VCS work.
- `sed`/`awk` read-only pipelines route to the existing read nudge, now naming
  the native `Read` tool.
- `tgrep` is documentation only: no dependency, no install step and no runtime
   detection. It is the secondary content-search option after `Grep`, never the
   first recommendation.
- The new prompt is registered in `prompts/index.json` and gets a fixture, so
  `prompts:check` and `prompts-diff` stay green.
