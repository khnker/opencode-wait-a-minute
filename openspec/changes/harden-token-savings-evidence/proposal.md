# Change: Harden token-savings evidence

## Objective
Stop reporting synthetic savings as measured, and bound the metrics file.

## Why
`recordTokenSavings` compared the injected WAM lines against
`max(promptTokens,200)*30`, a constant with no measured counterpart, and passed
the assembled lines back in as `historyTokens`. Every turn therefore claimed
60–80 % savings without evidence, and `.wam/metrics/token-savings.json` grew
without bound (15 095 records / 2.6 MB in this repo).

## Additional scope
Provider-reported usage (`event` hook, `message.updated` / `step-finish`) is
recorded per session and is required before any savings claim.

## Non-goals
- Does not run a real A/B benchmark (a measured baseline must be supplied).
- Does not change the context admission policy.
- Does not add a tokenizer dependency.
