# Change: Bound noisy N1 context and recompute N2 next action

## Objective
Cap stale decision/recent-change sections, recompute the N2 next action from the
requirement state, and make the token heuristic calibratable.

## Why
`[wam N1 decisions]` and `[wam N1 recent]` injected up to 600/500 chars of
stale history every turn, and `[wam N2 task]` trusted `taskState.nextAction`
even when the state file said every requirement was verified. `estTokens` was
hard-coded to `chars/4`, wrong for Spanish/code.

## Non-goals
- Does not change the N0/N2 admission policy.
- Does not add a tokenizer dependency.
- Does not change context routing/ranking.
