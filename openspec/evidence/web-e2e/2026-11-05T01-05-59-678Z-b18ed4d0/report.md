# WAM web E2E

- Run: `2026-11-05T01-05-59-678Z-b18ed4d0`
- Result: **FAIL**
- Checks: 5/11 passed
- Duration: 787353 ms

## Environment

| Key | Value |
| --- | --- |
| node | 24.16.0 |
| opencode | 1.19.4 |
| git head | 033f8d70939330b1375b1fe2666586b3bfd3897f |
| git dirty | true |
| platform | linux x64 |

## Fixture and server

- Fixture: `/tmp/wam-web-e2e-fixture-9u5PeP`
- Report: `/tmp/opencode/wam-skills-C-1793840759`
- Server: http://127.0.0.1:38775 (pid 1854138, port 38775)
- Server log: `/tmp/opencode/wam-skills-C-1793840759/server.log`
- Session: `ses_e56c22f9affe2m7cySHsTrSIMa`
- Prompt: Escribí un README para agentes que explique cómo usar este proyecto. No implementes código; solo documentación.
- Approval prompt: `/wam contract approve`

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| server-ready | PASS | server answered GET /session |
| session-created | PASS | ses_e56c22f9affe2m7cySHsTrSIMa |
| contract-approved | PASS | contract.status=APPROVED |
| agent-pass-ran | FAIL | no agent results or WAM child session |
| agent-pass-settled | FAIL | gate.active=undefined agentRun.status=null |
| loop-complete | FAIL | phase=IMPLEMENTING requirements=1 |
| failure-surfaced | PASS | no failed/blocked run |
| no-empty-response | PASS | no empty-response failure |
| artifacts-present | FAIL | task.json=true loop-state.json=false |
| skills-injected | FAIL | no skill markers in main session |
| roles-observed | FAIL | fewer than 2 role sessions |

## Timeline

| At | Event | Detail |
| --- | --- | --- |
| 2026-11-05T01:05:59.699Z | server-spawned | http://127.0.0.1:38775 pid=1854138 |
| 2026-11-05T01:06:02.975Z | server-ready | http://127.0.0.1:38775 |
| 2026-11-05T01:06:02.990Z | session-created | ses_e56c22f9affe2m7cySHsTrSIMa |
| 2026-11-05T01:09:02.990Z | prompt-request-timeout | client timeout after 180000 ms |
| 2026-11-05T01:09:02.990Z | prompt-sent | Escribí un README para agentes que explique cómo usar este proyecto. No implementes código; solo documentación. |
| 2026-11-05T01:09:02.990Z | task-detected | /tmp/wam-web-e2e-fixture-9u5PeP/.wam/tasks/task-escribi-un-readme-para-agentes-que-explique-sess-HsTrSIMa |
| 2026-11-05T01:09:02.990Z | loop-snapshot | {"phase":"IMPLEMENTING","contract":"APPROVED","gateActive":null,"agentStatus":null,"requirements":["req-1:pending"],"decision":null} |
| 2026-11-05T01:19:03.913Z | loop-settled | phase=IMPLEMENTING decision=null |
| 2026-11-05T01:19:07.026Z | server-stopped | pid=1854138 |

## Roles

| Role | Title | Messages | Finish | Error |
| --- | --- | --- | --- | --- |
| n/a | n/a | 0 | n/a | no sessions collected |

## Artifacts

- `/tmp/opencode/wam-skills-C-1793840759/task.json`
- `/tmp/opencode/wam-skills-C-1793840759/sessions.json`
- `/tmp/opencode/wam-skills-C-1793840759/server.log`
- `/tmp/opencode/wam-skills-C-1793840759/plugin.log`

## Log tail

```text

Every step ends on a **completion criterion**, the condition that tells the agent the work is done. Two properties make it a lever:

- **Clarity**: can the agent tell done from not-done? A vague bound ("understanding reached") invites **premature completion**: ending the step before it is genuinely done, attention slipping to _being done_. The visible steps still ahead (the **post-completion steps**) supply the pull; the criterion's clarity is the resistance. Defend in order: **sharpen the bound first** (local and cheap); only if it is irreducibly fuzzy _and_ you observe the rush, hide the later steps by splitting the sequence. Hiding only works across a real context boundary (a hand-off or a subagent dispatch; an inline call leaves the later steps in context and clears nothing).
- **Demand**: how much it requires. "Every modified model accounted for" forces thorough work where "produce a change list" does not. Demand drives **legwork** (the digging the agent does within the work, latent in the wording rather than written as its own step), and it is not step-bound: "every rule applied" binds a body of flat reference just as "every step done" binds a sequence, which is how an all-reference document still carries an exhaustiveness bar.

The strongest criteria are both checkable and exhaustive.

## When to split

Splitting one document into two spends one of the two loads, so split only when the cut earns it:

- **By sequence**: split a run of steps where the post-completion steps tempt the agent to rush the one in front of it. Keeping them out of view drives more legwork on the current task. Beware the reverse: merging sequences exposes each step's later steps to what follows, inviting premature completion.
- **By invocation**, skill-specific: see [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md).

## Leading words

A **leading word** is a compact concept already living in the model's pretraining that the agent thinks with while running the document (_lesson_, _fog of war_, _tracer bullets_). Repeated as a token, never as a sentence, it accumulates a distributed definition and anchors a whole region of behaviour in the fewest tokens, by recruiting priors the model already holds. Coining your own works if you define it clearly, but a made-up word recruits no priors: you pay in definition tokens what a pretrained word gives free; reach for an existing word first.

It anchors twice. In the body, _execution_: the agent reaches for the same behaviour every time the word appears, and inside flat reference it focuses attention on a class of thing to look for. In a pointer, _invocation_: when the same word lives in your prompts, your docs, and your codebase, the agent links that shared language to the material and reaches it more reliably.

Hunt for opportunities to refactor with leading words. A triad spelled out at three sites, a pointer spending a sentence to gesture at one idea. Each is a passage begging to collapse into a single token:

- "fast, deterministic, low-overhead" → _tight_ (a _tight_ loop).
- "a loop you believe in" → _red_, turning a fuzzy gate into a binary observable state (the loop goes _red_ on the bug, or it doesn't).

You win twice: fewer tokens, and a sharper hook for the agent to hang its thinking on. Assume every document is carrying restatements that leading words retire. Go find them.

**Negation** is the failure mode beside this lever: steering by prohibition drags the forbidden behaviour into context and makes it _more_ available, not less. _Don't think of an elephant_, and the elephant is all there is; the negation is a weak modifier the strongly-activated concept overruns, so the ban half-reads as an instruction to do the thing. Prompt the **positive**: state the target behaviour ("write one-line comments") so the banned one is never spoken. A prohibition earns its place only as a hard guardrail you cannot phrase positively; even then, pair it with the positive target so attention lands on what to do.

## Pruning

- Keep each meaning in a **single source of truth**: one authoritative place, so changing the behaviour is a one-place edit. **Duplication** (the same meaning in more than one place) costs maintenance and tokens, and inflates a meaning's prominence on the ladder past its real rank. (The accidental inverse of a leading word, which repeats a token on purpose, never the meaning.)
- The **environment** is a source of truth too (`package.json` scripts, config files, the directory layout, `--help` output), and a document that restates it is a **cache**: a copy of a lookup, earning its load only when the lookup is expensive. Cache what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha no config confesses. Leave the one-file, one-command lookups to the environment, where they cannot go stale.
- Check every line for **relevance**: does it still bear on what the document does? A line loses relevance by never bearing on the task (mere exposition, or a branch that should be disclosed) or by going stale as the behaviour or world it describes changes. Shorter documents are easier to keep relevant. Without a pruning discipline the default fate is **sediment**: stale layers that settle because adding feels safe and removing feels risky, until you must core down through them to find what is still live.
- Hunt **no-ops** sentence by sentence: an instruction the model already obeys by default pays load to say nothing. The test (does it change behaviour versus the default?) is model-relative, not reader-relative: two people disagreeing about a no-op disagree about the default, and settle it by running the document, not by debate. When a sentence fails, delete the whole sentence rather than trim words from it. The test also grades leading words: a word too weak to beat the default (_be thorough_ when the agent is already thorough-ish) is a no-op, and the fix is a stronger word (_relentless_), not a different technique.

## Skill reduction

Reduction is maintenance, not shortening: lower context cost without changing activation, decisions, constraints, or failure handling. Apply this policy when pruning or restructuring an existing skill. Keep it in one authoritative place: this skill.

1. Name the skill's unique responsibility.
2. List every instruction that changes agent behaviour.
3. Remove no-ops, duplication, and stale content.
4. Preserve decision rules, constraints, and failure handling.
5. Move conditional knowledge behind an on-demand pointer.
6. Consolidate overlapping responsibilities before deleting content.
7. Keep explicit activation and exclusion boundaries.
8. Measure the token delta with the target tokenizer.
9. Validate activation, behaviour, and regression on representative tasks.

Reduce by type: routers aggressively; engineering moderately; diagnostic and verification conservatively; architecture selectively; UI after consolidating one authority per dimension; prototypes and handoff lightly; meta-skills with semantic validation. Prefer R1 pruning → R2 compression → R3 disclosure → R4 consolidation → R5 removal; never merge before each skill's differential behaviour is named.

The full rule set (`RED-01`..`RED-10`), type checklists, severity levels, and validation dimensions live in `references/skill-reduction.md`.
[wam N3 skill] dietrichgebert-ponytail-ponytail — Skill base (loadStrategy: "base")
# Ponytail

You are a lazy senior developer. The best code is the code never written. You solve the whole problem with the least new code. End your reply with one or two lines: what you skipped or did not check, and any risk the user must know.

Active for the whole session until the user says "stop ponytail" or "normal mode". Switch level: `/ponytail lite|full|ultra`.

## Before you write

Read the task and the code it touches. List every place your change must reach: callers, tests, fixtures, config, exports. Check what your change could break for users: data it would destroy or expose, callers that stop working. That is scope. Extra features are not.

## The smallest complete change

Take the first option that fully works:

1. Does it need to exist? Skip features, options and flexibility nobody asked for, and name them in one line. A vague request ("build me X") gets the smallest version that does the core job.
2. Already in this codebase (a helper, component, service, pattern)? Use it the way the surrounding code does.
3. Standard library or a platform feature? Use it, unless the project has its own. A house component beats a native widget.
4. An installed dependency? Use it. Never add a dependency for a few lines.
5. Can it be one line a reader gets at a glance? One line.
6. Otherwise: the minimum code that works.

- Be lazy about the solution, never about the change itself: finish every part the task needs, including the callers, tests and fixtures your change breaks.
- No abstraction, wrapper, type conversion, option, config, boilerplate or "for later" code nobody asked for. Keep values in the form the platform already gives you. Deletion beats addition. Keep the structure the codebase already has: its layers, interfaces and conventions.
- The shortest working diff wins, once you know everything it must touch. A one-liner that needs decoding is not short.
- Comment only the why the code cannot show, in one line.
- Bug fix: before you edit, grep every caller of the function you touch, then fix the root cause once in the shared code.
- Code you move or merge keeps its error handling and validation.
- Between options of equal size, take the one that is correct on edge cases.
- Lazy code without its check is unfinished: new non-trivial logic (a branch, a loop, a parser, money or security, or a whole new script or app) leaves one small test or an assert-based self-check. Trivial changes need none.
- A shortcut with a known limit gets a `ponytail:` comment that names the limit and when to upgrade.

Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs, anything the user asked for.

## Levels

| Level | Behavior |
|-------|----------|
| **lite** | Build what was asked. Name the smaller option in one line and let the user pick. |
| **full** | The rules above. Default. |
| **ultra** | Also question the request: before building, push back on any part the need does not justify. |

[wam cqe] sin resultados en 1ms — contexto nativo prevalece
[wam delegation] PROPUESTA sin fricción: por defecto, delegá cada req pendiente independiente a un subagente via Task, en paralelo. Contexto justo por subagente: SOLO objetivo del req + dominio/archivos relevantes + criterio de aceptación; nunca el historial completo. No delegues tareas triviales (≤1 edición): resolvelas inline. La sesión principal puede editar/escribir inline sin pedir permiso. Fallback: secuencial → tier más barato → inline con evidencia. Nunca abortar en silencio por fallo de delegación.
  req-1 → Task(parallel) "Escribí un README para agentes que explique cómo usar este proyecto. No implementes código; solo documentación"
🔐 [wait-a-minute] PERMISOS SUGERIDOS (informativo, no bloquea)
- edit: La implementación aprobada requiere editar archivos
Recomendación: permisos sugeridos sin aprobar (edit) — continúo igualmente; revisá el plan con /wam status si algo falla.
skills activas: codebase-design,writing-for-agents,ponytail,bailian-managed-agent
requisitos: Escribí un README para agentes que explique cómo usar este proyecto. No implementes código; solo documentación
Plan: Ejecutar lo pedido con soporte de skills WAM.
/wam contract edit → ajustar contrato | /wam compress → resumen terse
fase IMPLEMENTING → Implementar — contrato bootstrap aprobado
[wam history]
- (task:task-escribi-un-readme-para-agentes-que-explique-sess-HsTrSIMa) Escribí un README para agentes que explique cómo usar este proyecto. No implementes código; solo documentación — Escribí un README para agentes que explique cómo usar este proyecto. No implementes cód
[wam][end]
[WAM-BENCHMARK] 'evaluate-action' took 0.807ms {
  tool: "bash",
  level: "GUARDED",
}
[WAM-DEBUG 2026-11-05T01:06:08.267Z] [risk-envelope] evaluateAction(bash) -> level=GUARDED {
  reason: undefined,
  tool: "bash",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T01:06:08.268Z] [governance] enforceGovernance(bash) -> ALLOWED {
  isSubagent: false,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[wait-a-minute] CQE-FIRST NUDGE (bash): Prefer '/wam ctx get "<query>"' (CQE index, fastest) over raw bash file listing/finding; fallback: dedicated 'glob' tool.
[WAM-BENCHMARK] 'evaluate-action' took 0.011ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T01:06:11.286Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T01:06:11.286Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: false,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.009ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T01:06:11.343Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T01:06:11.343Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: false,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.017ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T01:06:13.303Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T01:06:13.303Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: false,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.02ms {
  tool: "read",
  level: "SAFE",
}
[WAM-DEBUG 2026-11-05T01:06:13.494Z] [risk-envelope] evaluateAction(read) -> level=SAFE {
  reason: undefined,
  tool: "read",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T01:06:13.494Z] [governance] enforceGovernance(read) -> ALLOWED {
  isSubagent: false,
  phase: "IMPLEMENTING",
  enforcement: true,
}
[WAM-BENCHMARK] 'evaluate-action' took 0.013ms {
  tool: "bash",
  level: "GUARDED",
}
[WAM-DEBUG 2026-11-05T01:06:15.310Z] [risk-envelope] evaluateAction(bash) -> level=GUARDED {
  reason: undefined,
  tool: "bash",
  enforcement: true,
}
[WAM-DEBUG 2026-11-05T01:06:15.310Z] [governance] enforceGovernance(bash) -> ALLOWED {
  isSubagent: false,
  phase: "IMPLEMENTING",
  enforcement: true,
}

[2026-11-05T01:06:03.048Z] [INFO] [pipeline-routing] Starting routeSkillsV2. Mode: STANDARD, Prompt: Escribí un README para agentes que explique cómo u...
[2026-11-05T01:06:03.097Z] [INFO] [AuditPersist] AuditPersist: flushed 25 entries
[2026-11-05T01:06:05.097Z] [INFO] [AuditPersist] AuditPersist: flushed 2 entries

```
