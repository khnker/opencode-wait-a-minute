# WAM web E2E

- Run: `2026-11-05T00-08-25-893Z-cd319b88`
- Result: **PASS**
- Checks: 9/9 passed
- Duration: 157083 ms

## Environment

| Key | Value |
| --- | --- |
| node | 24.16.0 |
| opencode | 1.19.4 |
| git head | 9108d8b7ce492b950d069ca23910a0bd51e85a1c |
| git dirty | true |
| platform | linux x64 |

## Fixture and server

- Fixture: `/tmp/wam-web-e2e-fixture-Eh3IAn`
- Report: `/tmp/wam-web-e2e-final6`
- Server: http://127.0.0.1:34875 (pid 1757897, port 34875)
- Server log: `/tmp/wam-web-e2e-final6/server.log`
- Session: `ses_e56f6e305ffe1IHP5KJ345baDY`
- Prompt: Implementá add.js con una función que sume dos números y add.test.mjs usando node:test. Verificá con node --test add.test.mjs.
- Approval prompt: `/wam contract approve`

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| server-ready | PASS | server answered GET /session |
| session-created | PASS | ses_e56f6e305ffe1IHP5KJ345baDY |
| contract-approved | PASS | contract.status=APPROVED |
| agent-pass-ran | PASS | agent results or WAM child session present |
| agent-pass-settled | PASS | gate.active=false agentRun.status=COMPLETED |
| loop-complete | PASS | phase=DONE requirements=2 |
| failure-surfaced | PASS | no failed/blocked run |
| no-empty-response | PASS | no empty-response failure |
| artifacts-present | PASS | task.json=true loop-state.json=true |

## Timeline

| At | Event | Detail |
| --- | --- | --- |
| 2026-11-05T00:08:25.915Z | server-spawned | http://127.0.0.1:34875 pid=1757897 |
| 2026-11-05T00:08:29.171Z | server-ready | http://127.0.0.1:34875 |
| 2026-11-05T00:08:29.186Z | session-created | ses_e56f6e305ffe1IHP5KJ345baDY |
| 2026-11-05T00:08:54.608Z | prompt-sent | Implementá add.js con una función que sume dos números y add.test.mjs usando node:test. Verificá con node --test add.test.mjs. |
| 2026-11-05T00:08:54.608Z | task-detected | /tmp/wam-web-e2e-fixture-Eh3IAn/.wam/tasks/task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY |
| 2026-11-05T00:08:54.609Z | loop-snapshot | {"phase":"IMPLEMENTING","contract":"APPROVED","gateActive":true,"agentStatus":null,"requirements":["req-1:pending","req-2:pending"],"decision":null} |
| 2026-11-05T00:10:59.812Z | loop-snapshot | {"phase":"DONE","contract":"APPROVED","gateActive":false,"agentStatus":"COMPLETED","requirements":["req-1:verified","req-2:verified"],"decision":"COMPLETE"} |
| 2026-11-05T00:10:59.813Z | loop-settled | phase=DONE decision=COMPLETE |
| 2026-11-05T00:11:02.974Z | server-stopped | pid=1757897 |

## Roles

| Role | Title | Messages | Finish | Error |
| --- | --- | --- | --- | --- |
| REVIEWER | WAM REVIEWER task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY:REVIEWER:1 | 3 | stop |  |
| BUILDER | WAM BUILDER task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY:BUILDER:1 | 4 | stop |  |
| ARCHITECT | WAM ARCHITECT task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY:ARCHITECT:1 | 4 | stop |  |
| ANALYST | WAM ANALYST task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY:ANALYST:1 | 19 | stop |  |

## Artifacts

- `/tmp/wam-web-e2e-final6/task.json`
- `/tmp/wam-web-e2e-final6/loop-state.json`
- `/tmp/wam-web-e2e-final6/loop-events.jsonl`
- `/tmp/wam-web-e2e-final6/sessions.json`
- `/tmp/wam-web-e2e-final6/server.log`
- `/tmp/wam-web-e2e-final6/plugin.log`

## Log tail

```text
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:09:32.352Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:09:32.352Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.008ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:09:34.783Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:09:34.783Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.06ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:09:54.795Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:09:54.795Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.071ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:09:55.022Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:09:55.022Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.076ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:09:55.220Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:09:55.221Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.016ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:09:56.842Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:09:56.842Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.015ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:09:57.077Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:09:57.077Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.015ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:09:57.586Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:09:57.586Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.056ms {
  tool: "bash",
  level: "GUARDED",
}
[WAM-DEBUG 2026-11-05T00:10:21.946Z] [risk-envelope] evaluateAction(bash) -> level=GUARDED {
  reason: undefined,
  tool: "bash",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:10:21.946Z] [governance] enforceGovernance(bash) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[wait-a-minute] CQE-FIRST NUDGE (bash): Prefer '/wam ctx get "<query>"' (CQE index, fastest) over raw bash file listing/finding; fallback: dedicated 'glob' tool.
[WAM-BENCHMARK] 'evaluate-action' took 0.061ms {
  tool: "bash",
  level: "GUARDED",
}
[WAM-DEBUG 2026-11-05T00:10:24.926Z] [risk-envelope] evaluateAction(bash) -> level=GUARDED {
  reason: undefined,
  tool: "bash",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:10:24.926Z] [governance] enforceGovernance(bash) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.017ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:10:41.609Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:10:41.609Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.007ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:10:41.865Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:10:41.865Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.017ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:10:42.111Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:10:42.111Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.014ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T00:10:42.607Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:10:42.607Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: true,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T00:10:59.263Z] [[wait-a-minute] agent pass settled task-implementa-add-js-con-una-funcion-que-sume-dos-sess-J345baDY (gate released)] undefined {}

[2026-11-05T00:08:29.246Z] [INFO] [pipeline-routing] Starting routeSkillsV2. Mode: STANDARD, Prompt: Implementá add.js con una función que sume dos núm...
[2026-11-05T00:08:31.297Z] [INFO] [AuditPersist] AuditPersist: flushed 19 entries

```
