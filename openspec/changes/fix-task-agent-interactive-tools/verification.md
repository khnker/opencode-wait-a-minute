# Verification

## Unit

```
node --test --test-force-exit tests/unit/agent-invocation-adapter.test.mjs
# 32 passed, 0 failed
```

Covers `question: false` for `ANALYST`, `ARCHITECT`, `REVIEWER` and `BUILDER`,
plus the role prompt instruction to use `openQuestions` instead of asking.

## Fresh-session web E2E

```
npm run verify:web -- --out /tmp/wam-interactive-web-1793848156 --model opencode/gemini-3.8-flash
```

- Result: **PASS**, 11/11 checks
- Roles observed: `REVIEWER`, `BUILDER`, `ARCHITECT`, `ANALYST`
- Loop completed with `phase=DONE`, `agentRun.status=COMPLETED`
- Report: `/tmp/wam-interactive-web-1793848156/report.md`

The earlier live failure was an ANALYST child invoking `question` and waiting
300 s for a human reply (`WAIT_USER`). With the tool disabled and the prompt
rule in place, the role returns a JSON result and the loop settles.

## Residual risk

- Other interactive tools added by OpenCode in the future must be disabled in
  `READ_ONLY_TOOLS`; the policy is explicit, not an allowlist.
