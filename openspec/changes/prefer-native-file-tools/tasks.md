# Tasks: Prefer native file tools over shell grep/sed

## Tasks List

### [T-01] Reword discovery nudges
- [x] Name native tools (`Read`, `Grep`, `Glob`, `Edit`/`Write`) in all discovery nudges
- [x] Keep the change documentation-only (no runtime dependency)
- [x] Document `tgrep` as the secondary content-search fallback

### [T-02] Add the edit nudge
- [x] Create `nudge.discovery.edit` for `sed -i` / `awk` writes
- [x] Register it in `prompts/index.json` and add its fixture
- [x] Update characterization expectations

### [T-03] Route shell edits to the edit nudge
- [x] Tag `sed -i` and `awk` write branches with `shellEdit`
- [x] Make `nudgeFor` return the edit nudge for shell edits
- [x] Route read-only `sed`/`awk` to the read nudge
- [x] Preserve `null` for unrelated justified commands

### [T-04] Align the discovery policy text
- [x] Replace the `grep`-first rule with native-first wording
- [x] Add the read/edit rule for files

### [T-05] Tests and validation
- [x] Add classifier/nudge regression tests
- [x] Run affected suites with `node --test --test-force-exit`
- [x] Run `npm run prompts:check`, `npm run build`, `openspec validate --changes --strict`
- [x] Run `npm run verify:web -- --out /tmp/wam-web-e2e-native-tools-4`
