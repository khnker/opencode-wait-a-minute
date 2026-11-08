# Design: Production-Safe Runtime Defaults

## Research

- Node.js process environment and HTTP server lifecycle: <https://nodejs.org/api/http.html#serverlisten>
- Twelve-Factor App, config in the environment: <https://12factor.net/config>
- npm package publishing and `files` allowlist: <https://docs.npmjs.com/cli/v10/configuring-npm/package-json>
- OpenCode plugin loading: <https://opencode.ai/docs/plugins>

## Alternatives

1. **Dashboard on by default with auto-selected port** — rejected: still opens a network listener and exposes session metadata without consent.
2. **Config-file-only opt-in** — rejected for the first release: `WAM_DASHBOARD` is a single, explicit environment switch that works before any project config exists.
3. **Environment switch plus existing port variable** — chosen: smallest complete diff, no new config schema, and easy to set in a shell or service unit.

## Decision

- `DEFAULT_WAM_CONFIG.logging` becomes `false`.
- `index.js` gates `server.listen(...)` behind `WAM_DASHBOARD` (`1` or `true`, case-insensitive).
- `WAM_DASHBOARD_PORT` remains the opt-in port.
- No console output is emitted when the dashboard is disabled.

## Risks

- Users who relied on the implicit dashboard must set `WAM_DASHBOARD=true`.
- Tests or tooling that assumed default console logging must opt in explicitly.
