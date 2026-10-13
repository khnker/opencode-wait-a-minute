# Proposal: Prompt Iteration and Regression Harness
Give every prompt change a reproducible base-vs-candidate comparison over fixed inputs, measuring token delta, restriction integrity and preserved requirements; separate deterministic local checks from real-model evaluation.
Prompts are behavioral artifacts (see `centralize-and-version-wam-prompts`), but a prompt edit is currently validated only by the catalog integrity check and characterization tests. There is no way to answer "did this rewrite preserve the restriction and the contract, and what did it cost in tokens?" before shipping it. This change adds a developer-facing harness that renders a prompt with a stable fixture, diffs base against candidate, and refuses to treat a smaller prompt as an improvement on its own.
## Goals
1. Provide one fixture per registered prompt with concrete interpolation variables.
2. Capture the exact rendered string a consumer receives from `loadPrompt(id, vars)` for both base and candidate.
3. Report token delta, placeholder parity, restriction integrity and preserved requirements for every comparison.
4. Enforce quality over token count: a smaller candidate is NOT an acceptance; restriction integrity and placeholder parity MUST hold.
5. Keep the harness deterministic and offline by default; real-model evaluation is opt-in and excluded from CI.
