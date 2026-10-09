# Design: Package Identity & Installation

## Architecture

```
npm pack --silent
       ↓
/tmp/wam-tarball-XXXX/package.tgz
       ↓
npm install <tgz> --no-audit --no-fund --ignore-scripts
       ↓
/tmp/wam-tarball-XXXX/node_modules/opencode-wait-a-minute/
       ↓
import("<installed>/index.js")
       ↓
assert(package.name === "opencode-wait-a-minute")
```

## Implementation

### `scripts/verify-tarball-install.mjs`

```js
// 1. npm pack --silent → tarball in tmpdir
// 2. npm install <tarball> --no-audit --no-fund --ignore-scripts → isolated install
// 3. read <installed>/node_modules/<name>/package.json
// 4. assert name === "opencode-wait-a-minute"
// 5. Exit 0 on success, 1 on any failure
```

Flags used: `--no-audit --no-fund --ignore-scripts` — offline-safe, no network prompts, no postinstall scripts run in the temp dir.

### `package.json`

Add `"verify:tarball": "node scripts/verify-tarball-install.mjs"`.

### Release-gate extension

Inspect `.github/workflows/`. If a release gate workflow exists, extend it with a step that runs `npm run verify:tarball` before the existing smoke test. If no workflow exists, add a standalone assertion block to `scripts/release-gate.mjs` that calls the tarball verifier.

### Identity unification

Find all occurrences of `wait-a-minute` that are not `opencode-wait-a-minute` and not the legacy filename `wait-a-minute-test.mjs`, and replace them with `opencode-wait-a-minute`. Clone URLs in docs use `https://github.com/khnker/opencode-wait-a-minute.git`.

### Backward compatibility

- Legacy filename `wait-a-minute-test.mjs` is preserved as-is.
- The only observable change is the canonical package name everywhere users see it.
