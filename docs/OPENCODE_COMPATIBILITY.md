# OpenCode Compatibility Contract

## Minimum supported OpenCode version
**1.18.0**

## Tested OpenCode version
**1.18.33** (global binary `/home/nicolas/.nvm/versions/node/v24.16.0/bin/opencode`)

## Maximum tested OpenCode version
**1.18.33** (same as tested)

## Known incompatible versions
None declared; versions <1.18.0 may lack required plugin APIs.

## Required APIs/hooks

The plugin registers as a **session prompt hook** and integrates via the following OpenCode extension points, accessed through the `plugin` argument in `index.js`:

### Hooks used
- `plugin.on('chat.message', handler)`  
  Intercepts user prompts before agent execution (pre-flight).

- `plugin.on('tool.execute.before', handler)`  
  Runs before tool execution (used for assumption gating and evidence collection).

- `plugin.on('tool.execute.after', handler)`  
  Runs after tool execution (used for completion verification and state updates).

- `plugin.on('permission.ask', handler)`  
  Interacts with permission prompts (used to gate autonomous actions).

- `plugin.on('event', handler)`  
  Generic event bus (used for lifecycle observation, e.g. task start/completion).

### Plugin export signature
The module exports a default async factory function matching OpenCode's plugin loader contract:

```js
export default async ({ plugin, input, ... }) => ({ ... })
```

Where:
- `plugin`: OpenCode plugin API instance (provides `.on()` for hooks above).
- `input`: Session-scoped input bag (contains `taskId`, `root`, etc.).
- Return value: Object with cleanup/dispose methods (currently none).

### File system contract
- Reads/writes state under `<projectRoot>/.wam/`:
  - `.wam/active-task` (single file, current task ID).
  - `.wam/tasks/<taskId>/` (per-task directory: `context.md`, snapshots).
  - `.wam/snapshots/` (global historical snapshots).

### Node.js version
- **engines.node**: `>=20` (from `package.json`).

## Validation
The contract is validated by:
- Real OpenCode E2E test (`npm run test:e2e:opencode`).
- Plugin load smoke test (`npm run smoke`).
- Unit/integration test suite (`npm test`).

If any of the above APIs change or are removed in a future OpenCode version, this document must be updated and the E2E test will fail, signalling incompatibility.