# Task Lifecycle Agent Profiles & Governance

## 1. Start Phase (Exploration & Pre-flight)
- **Primary Agent**: `@fast` (cost-saver)
- **Objectives**:
  - Load cached governance and index state.
  - Query relevant historical changes and architectural specs.
  - Zero cold-search penalty via trigram index warm-up.
- **Rules**: Read-only exploration, no code edits, minimize token usage.

## 2. Implementation Phase (Execution)
- **Primary Agent**: `@medium` (coding) / `@backend-exec` / `@frontend-exec`
- **Objectives**:
  - Follow active OpenSpec change tasks.
  - Implement minimum required code modifications.
  - Respect runtime guards, loop budgets, and session read ledgers.
- **Rules**: Zero-redundancy, strict adherence to cross-layer contracts.

## 3. Validation & Completion Phase (Review & Archive)
- **Primary Agent**: `@arch-review` / `@debugger`
- **Objectives**:
  - Run test suites (`npm test`) and OpenSpec validation (`openspec validate --all --strict`).
  - Verify token savings and retrieval benchmarks.
  - Archive completed change (`openspec archive`).
- **Rules**: No push/commit without explicit user approval.
