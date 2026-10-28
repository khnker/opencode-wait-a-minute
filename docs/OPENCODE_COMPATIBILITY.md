# OpenCode Compatibility Contract

## Minimum supported OpenCode version
**1.18.0** — declared policy only, **not enforced by any gate**. The machine-readable
matrix (`tests/e2e/opencode/compatibility-matrix.mjs`) keeps `opencode.minimum` as `null`
(undetermined), so `scripts/check-compatibility.mjs` reports `opencode SKIP` and exits `0`
unless `--min-opencode` is passed explicitly. See "Discovered constraints".

## Tested OpenCode version
**1.19.0** (global binary `/home/nicolas/.nvm/versions/node/v24.16.0/bin/opencode`).
**1.18.33** was the previously recorded tested version.

## Maximum tested OpenCode version
**1.19.0** (same as tested)

## Known incompatible versions
None declared; versions <1.18.0 may lack required plugin APIs.

## Required APIs/hooks

The plugin registers as a **session prompt hook** and integrates via the following OpenCode extension points, accessed through the `plugin` argument in `index.js`:

### Hooks used
The plugin registers its hooks by **returning a hook map from the plugin factory**.
It does **not** call `plugin.on(...)`: there is no `plugin` API object in the plugin
input under OpenCode 1.19, so no event subscription is performed.

- `"chat.message"` (returned hook map)
  Intercepts user prompts before agent execution (pre-flight).

- `"tool.execute.before"` (returned hook map)
  Runs before tool execution (used for assumption gating and evidence collection).

- `"tool.execute.after"` (returned hook map)
  Runs after tool execution (used for completion verification and state updates).

- `"command.execute.before"` (returned hook map)
  Handles the `/wam` CLI commands delivered by OpenCode 1.18.25+.

- `"permission.ask"` (returned hook map)
  Auto-allows access permissions already granted by the task's permission preflight plan.

`event` is **not** registered by the plugin.

### Plugin export signature
The module exports a default async factory function matching OpenCode's plugin loader contract:

```js
export default async (input) => ({
  "chat.message": async (input, output) => {},
  "tool.execute.before": async (input, output) => {},
  "tool.execute.after": async (input, output) => {},
  "command.execute.before": async (input, output) => {},
})
```

Where:
- `input`: OpenCode plugin input — `client`, `project`, `worktree`, `directory`,
  `experimental_workspace`, `serverUrl`, `$`. There is no `plugin` key.
- `input.directory`: the project directory used as the `.wam/` state root
  (falls back to `process.cwd()`).
- Return value: the hook map above. No cleanup/dispose methods are returned.

### File system contract
- Reads/writes state under `<projectRoot>/.wam/`, where `<projectRoot>` is
  `input.directory` (falling back to `process.cwd()`):
  - `.wam/active-task` (single file, current task ID).
  - `.wam/tasks/<taskId>/` (per-task directory: `context.md`, snapshots).
  - `.wam/snapshots/` (global historical snapshots).
  - `.wam/context/`, `.wam/skills/`, `.wam/cache/`, `.wam/history/`,
    `.wam/traces/`, `.wam/metrics/` (created by `initMemory`).
- `WAM_HOME` is **not** read by the runtime. It is not part of the plugin contract
  and must not be used to relocate the state directory.

### Node.js version
- **engines.node**: `>=20` (from `package.json`).

## Validation
The contract is validated by:
- Real OpenCode E2E test (`npm run test:e2e:opencode`).
- Plugin load smoke test (`npm run smoke`).
- Unit/integration test suite (`npm test`).

## Discovered constraints (validated against OpenCode 1.19.0)

These were observed while validating this contract against a real OpenCode 1.19.0
install and are now enforced by `tests/e2e/opencode/smoke.mjs`.

### 1. The OpenCode version axis is not machine-enforced
`tests/e2e/opencode/compatibility-matrix.mjs` declares `opencode.minimum: null`
("undetermined"): compatibility is a matrix, not a single install. Consequently
`scripts/check-compatibility.mjs` only enforces OpenCode when a minimum is supplied:

```bash
node scripts/check-compatibility.mjs                                  # node OK, opencode SKIP, exit 0
node scripts/check-compatibility.mjs --node 18.0.0                    # FAIL [node], exit 1
node scripts/check-compatibility.mjs --min-opencode 1.18.0 --opencode 0.9.0   # FAIL [opencode], exit 1
node scripts/check-compatibility.mjs --min-opencode 1.18.0 --opencode 1.19.0   # exit 0
```

The Node axis is always enforced (`>=20`, sourced from `package.json#engines.node`).
The `1.18.0` minimum stated above is a policy statement, not a gate — keep both in
sync if either side changes.

### 2. Hook registration style
Hooks are registered by returning a hook map from the plugin factory, not through
`plugin.on(...)`. The E2E adapter records both styles and asserts that
`chat.message`, `tool.execute.before` and `tool.execute.after` are registered.

### 3. `chat.message` carries no user text under 1.19
The 1.19 payload is `input = {sessionID, agent, model, messageID, variant}` and
`output = {message}` — the message has no `parts`, and neither `input.parts` nor
`input.text` is populated. The prompt gate therefore cannot read the prompt text
from this hook. `.wam/` state is created from the tool hooks, so **a session that
never executes a tool never creates `.wam/`**. The E2E prompt deliberately forces a
bash tool call for that reason.

### 4. OpenCode resolves the project directory from `PWD`
`spawn()` changes the child's working directory but leaves the inherited `PWD`
environment variable pointing at the checkout; OpenCode then resolves the session
against the repository instead of the isolated workspace. Any harness that spawns
OpenCode against a temporary workspace **must** override `PWD` (and `INIT_CWD`)
alongside `HOME`/`XDG_*`, otherwise it is not isolated and the plugin writes its
`.wam/` state into the real repository.

### 5. Transient model-backend failures
The live backend intermittently stalls (no output, no exit), exits non-zero without
a plugin error, or answers without the expected payload. The E2E treats those as
transient and retries up to 3 attempts before failing the run.


If any of the above APIs change or are removed in a future OpenCode version, this document must be updated and the E2E test will fail, signalling incompatibility.