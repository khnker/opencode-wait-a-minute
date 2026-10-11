# Proposal: Discovery Tool-First Routing

## Why
Analysis of 174,202 tool calls reveals that `bash` accounts for 87,228 calls (50%), dominated by exploratory commands: `cd` (21,697), `grep`/`rg` (17,299), `ls` (7,329), `cat`/`head`/`tail`/`sed` (6,569), and `find` (2,510). Meanwhile, dedicated tools (`grep`, `glob`, `read`) and the indexed MCP `context-query-engine` (`read_file`, `search_files`, `context_query`) are severely underutilized. Raw bash discovery is slow, uncached, and unindexed. Wait-a-Minute (WAM) must proactively route discovery tasks to dedicated tools and the context-query-engine MCP first, permitting bash only when strictly justified.

## What Changes
- Introduce a discovery classifier module (`src/policy/discovery-classifier.js`) that distinguishes read-only discovery bash commands from justified execution bash commands (such as multi-command pipelines, build scripts, or state modifications).
- Integrate the classifier into the execution runtime (`src/execution/runtime-guards.js`) and risk engine (`src/policy/risk-engine.js:160`).
- Provide actionable nudges suggesting dedicated tools (`grep`, `glob`, `read`) or the `context-query-engine` MCP when non-justified bash discovery is detected (with configurable enforce mode).
- Ensure robust handling of directory changes via `workdir` rather than `cd X && ...`.
- Guarantee deterministic evaluation with zero state mutation on classification errors.

## Capabilities with **New Capabilities**

### New Capabilities
- `discovery-tool-first-routing`: Intelligent classification and routing of bash discovery commands to dedicated tools and MCP context query engines, providing actionable nudges and safety guardrails.

## Impact
- Significantly reduces reliance on raw bash for file discovery, search, and reading.
- Improves discovery performance and caching by leveraging the trigram index and context-query-engine MCP.
- Maintains full backwards compatibility and developer control via configurable enforcement modes.
