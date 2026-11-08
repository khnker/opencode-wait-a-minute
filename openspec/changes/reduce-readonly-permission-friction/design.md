# Design: reduce-readonly-permission-friction

## Research

- opencode permissions (agent `permission` map + `opencode.json` `permission.bash`
  globs): https://opencode.ai/docs/permissions/
- opencode plugin hooks `permission.ask` / `tool.execute.before`:
  https://opencode.ai/docs/plugins/
- WAM local evidence: `src/policy/permission-preflight.js` always returns `allow`;
  `src/policy/discovery-classifier.js` classifies `sed`, `rg`, `echo` as read-only.

## Decisions (approved strategy)

### D1-SEPARATE-LAYERS
Treat the report as two separable problems: (a) opencode bash approvals and
(b) WAM advisory-notice noise. Diagnose and fix each in its own layer. WAM cannot
originate approval dialogs, so fixing only WAM would not remove real prompts.

### D1-CLASSIFY-BY-SOURCE
Attribute each prompt to its source. `sed`/`rg`/`echo` are read-only in WAM's
classifier and never block there; a real dialog therefore comes from the active
opencode permission configuration or another plugin.

## Alternatives

1. **Make WAM auto-approve more tool types** — rejected: WAM already answers
   `allow`; changing it cannot remove opencode dialogs and would blur layers.
2. **Silence the advisory permanently** — rejected: some users rely on the plan
   visibility; one-shot keeps the signal without the repetition.
3. **Chosen: gate the advisory once per task and document opencode allow-rules** —
   smallest diff, fixes the WAM-controlled noise, and gives the user an explicit
   layer-1 remedy.

## Layer 1 remedy (user config, not applied by WAM)

Read-only inspection commands can be allow-listed in the user's `opencode.json`:

```json
{
  "permission": {
    "bash": {
      "sed *": "allow",
      "rg *": "allow",
      "echo *": "allow",
      "cat *": "allow",
      "head *": "allow",
      "tail *": "allow",
      "ls *": "allow",
      "grep *": "allow"
    }
  }
}
```

Rules should be reviewed by the user: `sed -i` mutates files, and shell pipelines
can escape a naive prefix rule. WAM does not write this file.

## Behavior

`shouldNotifyPermissionPlan(state, plan)` returns false once
`state.permissionPreflightNotified` is true, so the notice is injected at most
once per task even though the plan stays pending.
