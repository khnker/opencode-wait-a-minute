# Design: support-global-wam-config

## Research

- XDG Base Directory Specification — defines `$XDG_CONFIG_HOME` (default
  `$HOME/.config`) as the per-user configuration root:
  https://specifications.freedesktop.org/basedir-spec/latest/
- Node.js `os.homedir()` — returns the current user's home directory, honoring
  platform conventions: https://nodejs.org/api/os.html#oshomedir
- Node.js `path.join` for platform-correct path composition:
  https://nodejs.org/api/path.html#pathjoinpaths

## Alternatives considered

1. **XDG-only global config** (`$XDG_CONFIG_HOME/wam/config.json` with the
   `~/.config` default). Simple and standards-based, but offers no escape hatch
   for tests, containers, or users with non-standard layouts.
   *Rejected as the sole mechanism.*

2. **Environment-variable-only global config** (`WAM_GLOBAL_CONFIG` only).
   Easy to isolate, but forces every user to export an env var; there is no
   "just works" default.
   *Rejected as the sole mechanism.*

3. **Chosen: layered resolution** — `WAM_GLOBAL_CONFIG` → `$XDG_CONFIG_HOME` →
   `~/.config`. Gives an explicit override for tests/containers, honors the XDG
   standard when present, and falls back to a conventional home path. Built on
   `os.homedir()` so Windows/macOS behave correctly.

4. **Chosen merge strategy: recursive deep merge of plain objects.** Arrays and
   scalars replace. This matches user expectations for nested config such as
   `taskLoop.agents` and keeps the smallest complete diff in `loadWamConfig`
   (no per-key global lookups).

5. **Rejected: array concatenation during merge.** Concatenation makes removal
   impossible and produces surprising ordering; replacement is predictable.

6. **Rejected: merging global when `WAM_CONFIG` is set.** `WAM_CONFIG` is
   documented as a full location override; merging a hidden global file would
   break reproducibility and the existing contract.

## Precedence

Environment variables → project file → global file → built-in defaults.
`WAM_CONFIG` short-circuits this: it replaces the file location entirely, so
only that file (not the project file, not the global file) feeds the merge.

## Failure handling

- Missing file: `{}`.
- Malformed JSON or non-object / array root: `{}`.
- Read errors: `{}`.
- Never throws; configuration loading is a soft boundary.

## Test isolation

`tests/unit/wam-config.test.mjs` sets `WAM_GLOBAL_CONFIG` to a unique missing
temp path in `beforeEach`, and `scripts/run-tests.mjs` injects the same kind of
missing path into the child env, so a developer's real global config cannot
influence the suite.

## Risks

- Adding `os` import and file reads is negligible; global file is only read when
  `WAM_CONFIG` is unset.
- Deep merge changes object identity for nested config, but consumers only read
  values.
