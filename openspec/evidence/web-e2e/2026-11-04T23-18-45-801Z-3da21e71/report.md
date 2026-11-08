# WAM web E2E

- Run: `2026-11-04T23-18-45-801Z-3da21e71`
- Result: **PASS**
- Checks: 9/9 passed
- Duration: 58066 ms

## Environment

| Key | Value |
| --- | --- |
| node | 24.16.0 |
| opencode | 1.19.4 |
| git head | 9108d8b7ce492b950d069ca23910a0bd51e85a1c |
| git dirty | true |
| platform | linux x64 |

## Fixture and server

- Fixture: `/tmp/wam-web-e2e-fixture-n5xOaA`
- Report: `/home/nicolas/dev/wait-a-minute-plugin/openspec/evidence/web-e2e/2026-11-04T23-18-45-801Z-3da21e71`
- Server: http://127.0.0.1:43151 (pid 1675106, port 43151)
- Server log: `/home/nicolas/dev/wait-a-minute-plugin/openspec/evidence/web-e2e/2026-11-04T23-18-45-801Z-3da21e71/server.log`
- Session: `ses_e572463d5ffeexZ8izkRs4oBQk`
- Prompt: Responde únicamente: ok
- Approval prompt: `/wam contract approve`

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| server-ready | PASS | server answered GET /session |
| session-created | PASS | ses_e572463d5ffeexZ8izkRs4oBQk |
| contract-approved | PASS | contract.status=APPROVED |
| agent-pass-ran | PASS | agent results or WAM child session present |
| agent-pass-settled | PASS | gate.active=false agentRun.status=COMPLETED |
| loop-complete | PASS | phase=DONE requirements=1 |
| failure-surfaced | PASS | no failed/blocked run |
| no-empty-response | PASS | no empty-response failure |
| artifacts-present | PASS | task.json=true loop-state.json=true |

## Timeline

| At | Event | Detail |
| --- | --- | --- |
| 2026-11-04T23:18:45.825Z | server-spawned | http://127.0.0.1:43151 pid=1675106 |
| 2026-11-04T23:18:47.074Z | server-ready | http://127.0.0.1:43151 |
| 2026-11-04T23:18:47.092Z | session-created | ses_e572463d5ffeexZ8izkRs4oBQk |
| 2026-11-04T23:18:55.676Z | prompt-sent | Responde únicamente: ok |
| 2026-11-04T23:18:55.676Z | task-detected | /tmp/wam-web-e2e-fixture-n5xOaA/.wam/tasks/task-responde-unicamente-ok-sess-kRs4oBQk |
| 2026-11-04T23:18:55.677Z | loop-snapshot | {"phase":"IMPLEMENTING","contract":"APPROVED","gateActive":null,"agentStatus":null,"requirements":["req-1:pending"],"decision":null} |
| 2026-11-04T23:18:56.677Z | loop-snapshot | {"phase":"IMPLEMENTING","contract":"APPROVED","gateActive":true,"agentStatus":null,"requirements":["req-1:pending"],"decision":null} |
| 2026-11-04T23:19:40.723Z | loop-snapshot | {"phase":"DONE","contract":"APPROVED","gateActive":false,"agentStatus":"COMPLETED","requirements":["req-1:verified"],"decision":"COMPLETE"} |
| 2026-11-04T23:19:40.723Z | loop-settled | phase=DONE decision=COMPLETE |
| 2026-11-04T23:19:43.865Z | server-stopped | pid=1675106 |

## Roles

| Role | Title | Messages | Finish | Error |
| --- | --- | --- | --- | --- |
| REVIEWER | WAM REVIEWER task-responde-unicamente-ok-sess-kRs4oBQk task-responde-unicamente-ok-sess-kRs4oBQk:REVIEWER:1 | 2 | stop |  |
| BUILDER | WAM BUILDER task-responde-unicamente-ok-sess-kRs4oBQk task-responde-unicamente-ok-sess-kRs4oBQk:BUILDER:1 | 2 | stop |  |
| ARCHITECT | WAM ARCHITECT task-responde-unicamente-ok-sess-kRs4oBQk task-responde-unicamente-ok-sess-kRs4oBQk:ARCHITECT:1 | 2 | stop |  |
| ANALYST | WAM ANALYST task-responde-unicamente-ok-sess-kRs4oBQk task-responde-unicamente-ok-sess-kRs4oBQk:ANALYST:1 | 2 | stop |  |

## Artifacts

- `/home/nicolas/dev/wait-a-minute-plugin/openspec/evidence/web-e2e/2026-11-04T23-18-45-801Z-3da21e71/task.json`
- `/home/nicolas/dev/wait-a-minute-plugin/openspec/evidence/web-e2e/2026-11-04T23-18-45-801Z-3da21e71/loop-state.json`
- `/home/nicolas/dev/wait-a-minute-plugin/openspec/evidence/web-e2e/2026-11-04T23-18-45-801Z-3da21e71/loop-events.jsonl`
- `/home/nicolas/dev/wait-a-minute-plugin/openspec/evidence/web-e2e/2026-11-04T23-18-45-801Z-3da21e71/sessions.json`
- `/home/nicolas/dev/wait-a-minute-plugin/openspec/evidence/web-e2e/2026-11-04T23-18-45-801Z-3da21e71/server.log`
- `/home/nicolas/dev/wait-a-minute-plugin/openspec/evidence/web-e2e/2026-11-04T23-18-45-801Z-3da21e71/plugin.log`

## Log tail

```text

**Adapter**: a concrete thing that satisfies an interface at a seam. Describes a role, not a substance.

**Leverage**: what callers get from depth: more capability per unit of interface learned; one implementation pays back across N call sites and M tests.

**Locality**: what maintainers get from depth: change, bugs, knowledge, and verification concentrate in one place rather than spreading across callers. Fix once, fixed everywhere.

## Deep vs shallow

Deep = small interface + lots of implementation. Shallow = large interface + little implementation (avoid).

When designing an interface, ask: can I reduce the number of methods, simplify the parameters, or hide more complexity inside?

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, mockable, swappable parts; they just aren't part of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test *past* the interface, the module is probably the wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a seam unless something actually varies across it.

## Designing for testability

1. **Accept dependencies, don't create them.** Pass collaborators in as parameters; a module that constructs its own gateway cannot be tested in isolation.
2. **Return results, don't produce side effects.** Return new values rather than mutating shared state.
3. **Small surface area.** Fewer methods and params mean fewer tests and simpler setup.

## Relationships

- A **Module** has exactly one **Interface** (the surface it presents to callers and tests).
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.

## Rejected framings

- **Depth as ratio of implementation-lines to interface-lines** (Ousterhout): rewards padding the implementation. We use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods**: too narrow: interface here includes every fact a caller must know.
- **"Boundary"**: overloaded with DDD's bounded context. Say **seam** or **interface**.

## Going deeper

- **Deepening a cluster given its dependencies**, see [DEEPENING.md](DEEPENING.md): dependency categories, seam discipline, and replace-don't-layer testing.
- **Exploring alternative interfaces**, see [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md): spin up parallel sub-agents to design the interface several radically different ways, then compare on depth, locality, and seam placement.
[wam N3 skill] writing-for-agents — Skill base (loadStrategy: "base")
Reference for writing any document an agent consumes: a skill, an `AGENTS.md` / `CLAUDE.md`, a doc reached by a pointer. The packaging differs; the writing does not: the same levers make each one predictable, since the agent takes the same _process_ every run rather than producing the same output.

When the document you're writing is a skill, read [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md) for frontmatter, invocation choice, and router skills.

## Context pointers

A **context pointer** is a reference held in the agent's context that names some out-of-context material and encodes the condition for reaching it. A skill's description is one; a line in `AGENTS.md` naming a doc is the same object. The pointer's _wording_, not its target, decides when the agent reaches the material, and how reliably. A must-have target behind a weakly worded pointer is a variance bug: sharpen the wording first, and inline the material only if sharpening fails.

A pointer does two jobs: state what the material is, and list the **branches** that should trigger reaching it (a branch is a distinct case the document handles, so different runs take different paths through it). Every word of an always-loaded pointer costs on every turn, so it earns even harder pruning than the body:

- **Front-load the leading word**: the pointer is where it does its triggering work.
- **One trigger per branch.** Synonyms that rename a single branch are one branch written twice; collapse them and keep only genuinely distinct branches.
- **Cut identity the body already carries.**

## The two loads

Every document and pointer you add spends one of two budgets:

- **Context load** is the cost of always-loaded material on the agent's window: an `AGENTS.md` line, a skill description, anything sitting in context every turn, spending tokens and attention whether or not it fires.
- **Cognitive load** is the cost on the human: which documents exist and when to reach for each. The human is the index. Not a cost to minimise: it is the price of human agency; spend it where human judgement matters, remove it where it does not.

Material reached only through a pointer escapes context load at the price of the pointer's own line; material with no pointer at all rides entirely on cognitive load.

## Information hierarchy

A document is built from two content types: **steps** (the ordered actions the agent performs) and **reference** (definitions, rules, facts consulted on demand). The two mix freely: all steps (a recipe), all reference (a review's rules, this skill), or both. The core decision is where each piece sits on the **information hierarchy**, a ladder ranked by how immediately the agent needs the material:

1. **In-file step** is the primary tier: what the agent does, in order.
2. **In-file reference** is consulted on demand. Often a legitimately flat peer-set (every rule of a review on one rung), which is a fine arrangement, not a smell.
3. **Disclosed reference** is pushed out into a separate file, reached by a context pointer, loaded only when the pointer fires. Spans a sibling file in the same folder through fully external reference that lives anywhere and any document can point at.

Push too little down and the top bloats; push too much and you hide material the agent actually needs. That tension is the whole decision.

**Progressive disclosure** is the move down the ladder (out of the main file and behind a pointer) so the top stays legible. Not primarily a token optimisation: it is how the hierarchy is protected. Branching is the cleanest disclosure test: inline what every branch needs, and push behind a pointer what only some branches reach. When a document has steps, in-file reference that should be disclosed buries them and turns attending to them into a coin-flip: a variance lever, not just a legibility one.

**Co-location** is the within-file companion: where the ladder decides _how far down_ a piece sits, co-location decides _what sits beside it_ once there. Keep a concept's definition, rules, and caveats under one heading rather than scattered, so reading one part brings its neighbours with it. The test: the document should read like documentation written for the agent. Grouped material reads that way; scattered material does not. (Distinct from duplication: that repeats one meaning in two places; scattering fragments one meaning across many.)

**Sprawl** is the failure mode here: a document simply too long, even when every line is live and unique. Attention thins across the excess, and every extra line is one more to keep relevant. The cure is the ladder: disclose reference behind pointers, and split by branch or sequence so each path carries only what it needs.

## Steps and completion criteria

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

[wam delegation] PROPUESTA sin fricción: por defecto, delegá cada req pendiente independiente a un subagente via Task, en paralelo. Contexto justo por subagente: SOLO objetivo del req + dominio/archivos relevantes + criterio de aceptación; nunca el historial completo. No delegues tareas triviales (≤1 edición): resolvelas inline. La sesión principal puede editar/escribir inline sin pedir permiso. Fallback: secuencial → tier más barato → inline con evidencia. Nunca abortar en silencio por fallo de delegación.
  req-1 → Task(parallel) "Responde únicamente: ok"
🔐 [wait-a-minute] PERMISOS SUGERIDOS (informativo, no bloquea)
- edit: La implementación aprobada requiere editar archivos
Recomendación: permisos sugeridos sin aprobar (edit) — continúo igualmente; revisá el plan con /wam status si algo falla.
skills activas: codebase-design,writing-for-agents,ponytail
requisitos: Responde únicamente: ok
Plan: Ejecutar lo pedido con soporte de skills WAM.
/wam contract edit → ajustar contrato | /wam compress → resumen terse
fase IMPLEMENTING → Implementar — contrato bootstrap aprobado
[wam history]
- (task:task-responde-unicamente-ok-sess-kRs4oBQk) Responde únicamente: ok — Responde únicamente: ok
[wam][end]
[WAM-DEBUG 2026-11-04T23:18:55.689Z] [[wait-a-minute] agent pass running task-responde-unicamente-ok-sess-kRs4oBQk (intent=IMPLEMENT)] undefined {}
[WAM-DEBUG 2026-11-04T23:19:40.391Z] [[wait-a-minute] agent pass settled task-responde-unicamente-ok-sess-kRs4oBQk (gate released)] undefined {}

[2026-11-04T23:18:47.169Z] [INFO] [pipeline-routing] Starting routeSkillsV2. Mode: STANDARD, Prompt: Responde únicamente: ok...
[2026-11-04T23:18:49.344Z] [INFO] [AuditPersist] AuditPersist: flushed 8 entries

```
