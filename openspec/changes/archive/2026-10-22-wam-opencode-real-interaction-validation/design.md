# Design: WAM-OpenCode Real Interaction Validation
## Approach
- Utilize the existing `npm pack` flow to simulate a user's installation of the plugin.
- Create an isolated `workspace` that does not depend on the source code checkout.
- Configure `opencode.jsonc` to load the plugin from the `node_modules` path of the installed package.
- Drive the real `opencode` CLI and assert observable interactions (plugin hooks triggering, `.wam/` state creation, round-trip model response).
- Validate the compatibility gate ensures required Node/OpenCode versions are present.
## Scope
- Artifact packaging integrity.
- OpenCode runtime configuration for plugin loading.
- Plugin hook activation verification.
- Persistent state directory management within the E2E environment.
- E2E harness resilience (timeout/retry logic for model interaction).
## Validation Strategy
- `npm pack` artifact verification.
- `opencode run` E2E execution success.
- Observation of plugin-generated files in isolated state directory.
- `check-compatibility.mjs` fail-fast validation in CI environment.
## Risks
- Environment contamination (e.g., global plugin registry settings).
- Intermittent stalls in the model backend causing false negatives.
- Plugin artifact path mismatch in the isolated `opencode.jsonc`.
