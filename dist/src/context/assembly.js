/**
 * Context Assembly Layer — Context Pack Builder.
 *
 * OpenSpec changes: context-assembly-layer, refactor-context-engine,
 * wam-context-budget-admission.
 *
 * Rol: decide qué nivel (N0/N1/N2/N3) entra al pack y emite N0/N1/N2.
 * Capsule selection dentro de N3 se delega a context.js (Context Selection Engine).
 *
 * Budget partitioning with admission policy:
 *   budget = reserved (MANDATORY) + flex (CONDITIONAL + OPTIONAL)
 *   MANDATORY items are preserved even if they exceed budget.
 *   OPTIONAL items are dropped first when budget is tight.
 *
 * Admission classes:
 *   MANDATORY  — N0, N2, required dependencies (never dropped)
 *   CONDITIONAL — cognition, relevant sections (dropped after OPTIONAL)
 *   OPTIONAL   — extra context, skills (dropped first)
 *
 * 4 niveles con fuente canónica, obligación y prohibición:
 *   N0 Global/Policy  — obligatorio, tiny (MANDATORY)
 *   N1 Project        — selectivo por dominio (CONDITIONAL)
 *   N2 Task           — obligatorio (live task state) (MANDATORY)
 *   N3 Session        — capsules por utility (OPTIONAL)
 *
 * Prohibido: L4 ephemeral, superseded, transcript, docs/dominios sin match.
 */

import fs from "node:fs";
import path from "node:path";
import { getOperationalContext, summarizeOperationalContext, normalizeConfidence, confidenceLabel } from "../persistence/memory.js";
import { selectContext, estimateCapsuleTokens, getSessionId } from "./context.js";
import { loadCognitiveState, compactCognitiveState } from "../cognition/cognitive-state.js";
import { routeAndAdapt } from "../integration/router-adapter.js";
import { buildContextGraph } from "./context-graph-builder.js";
import { buildRuntimeContextGraph } from "./runtime-context-graph.js";
import { ADMISSION } from "./context-router.js";
import { assembleDesignAxis } from "../design/design-integration.js";
import { classifyDesignTask, loadDesignContext } from "./design-context.js";

/**
 * Admission classes are sourced from Context Router.
 * Assembly must not reinterpret or reclassify admission decisions.
 */

/**
 * @typedef {Object} AdmissionItem
 * @property {string} level - Context level (N0, N1, N2, N3)
 * @property {string} admission - Admission class
 * @property {string} reason - Why this item has this admission class
 * @property {number} tokenCost - Estimated token cost
 * @property {string} text - The actual content
 */


function tokenize(text = "") {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function overlap(aTokens, bTokens) {
  if (!aTokens.size || !bTokens.size) return 0;
  let hit = 0;
  for (const t of bTokens) if (aTokens.has(t)) hit++;
  return hit / Math.max(aTokens.size, 1);
}

function estTokens(text) {
  const str = typeof text === "string" ? text : String(text || "");
  return Math.ceil(str.length / 4);
}

function extractRelevantSections(docName, body, taskTokens, { base = false } = {}) {
  const sections = (body || "").split(/^## /m).map((s) => s.trim()).filter(Boolean);
  if (base || !sections.length) return body || "";
  const hits = sections.filter((s) => overlap(taskTokens, tokenize(s.split("\n")[0] + " " + s.slice(0, 200))) > 0);
  if (!hits.length) return "";
  return "# " + hits.join("\n\n# ");
}

/**
 * Cap on individually-rendered requirement capsules in N3.
 *
 * Every requirement node is MANDATORY in the router, so a task with dozens of
 * requirements produces one capsule per requirement. The mandatory N2 line
 * already reports requirement counts, so listing each requirement here is
 * duplication that floods the pack. Above this cap the requirement set is
 * consolidated into a single summary line.
 */
const MAX_VISIBLE_REQS = 8;

function isRequirementCapsule(c) {
  return c?.scope === "requirement" || String(c?.context_id || "").startsWith("req-");
}

/**
 * Reduce un SKILL.md a un máximo de chars preservando Markdown (D).
 * Estrategia: si el contenido excede el presupuesto, conserva el bloque del
 * frontmatter inicial + las primeras secciones (encabezados `^##`) que mejor
 * coincidan con el `reason` de selección. Sólo si eso todavía excede, trunca
 * duro por longitud conservando saltos de línea.
 */
function pruneBySection(content, maxChars, reason) {
  if (content.length <= maxChars) return content;
  const markers = [];
  const re = /^#{1,6} .+$/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    markers.push({ index: m.index, end: content.indexOf("\n\n", m.index) === -1 ? content.length : content.indexOf("\n\n", m.index), header: m[0] });
  }
  if (markers.length === 0) {
    return content.slice(0, maxChars) + "\n...[truncado]";
  }
  // Rankea secciones por solap de tokens con el reason.
  const reasonTokens = String(reason || "").toLowerCase().split(/[^a-záéíóúñü0-9]+/).filter(Boolean);
  const ranked = markers.map((sec) => {
    const body = content.slice(sec.index, sec.end === -1 ? content.length : sec.end);
    const lower = body.toLowerCase();
    let hits = 0;
    for (const t of reasonTokens) if (t && lower.includes(t)) hits++;
    return { sec, hits };
  }).sort((a, b) => b.hits - a.hits);

  const out = [];
  let total = 0;
  for (const { sec } of ranked) {
    const slice = content.slice(sec.index, sec.end === -1 ? content.length : sec.end);
    if (total + slice.length > maxChars) {
      // Última oportunidad: cabe parcial.
      const room = maxChars - total;
      if (room > 80) out.push(slice.slice(0, room) + "\n...[truncado]");
      break;
    }
    out.push(slice);
    total += slice.length;
  }
  if (out.length === 0) return content.slice(0, maxChars) + "\n...[truncado]";
  return out.join("\n\n");
}

/**
 * Ensambla el Context Pack de la tarea.
 *
 * @returns { levels, lines, budget_used, budget, budget_violation, reserved, flex, rationale, continuation }
 */
import { wamStartTimer, wamWarn } from "../shared/wam-log.js";

export async function assembleContext(params = {}) {
  const timer = wamStartTimer("assemble-context", { taskId: params.taskId || "" });
  try {
    const res = await _assembleContextImpl(params);
    timer.end({ budget_violation: res.budget_violation });
    if (res.budget_violation) {
      wamWarn(`[WAM-ASSEMBLY] Context budget violation detected for task '${params.taskId || ""}'`);
    }
    return res;
  } catch (err) {
    timer.end({ error: err.message });
    throw err;
  }
}

async function _assembleContextImpl({
  prompt = "",
  taskId = "",
  classification = "normal",
  mode = "NORMAL",
  continuation = false,
  projectPath = process.cwd(),
  budget = 16000,
  taskState = null,
  runState = null,
  evidenceLineage = [],
  cognitionState = null,
  decisions = [],
  constraints = [],
  artifacts = [],
  observations = [],
  hypotheses = [],
  experiments = [],
  skillRegistry = null,
  selectedSkills = [],
  useLegacySelector = false,
  collector = null,
} = {}) {
  const levels = { N0: [], N1: [], N2: [], N3: [] };
  const rationale = [];
  const taskTokens = tokenize(prompt);
  let routerSufficiency = null;
  // C02: Context Router is the canonical authority. Legacy selector is opt-in
  // via WAM_CONTEXT_SELECTOR=legacy in env/options. Default is router-only.
  const legacySelectorAllowed = process.env.WAM_CONTEXT_SELECTOR === "legacy" || useLegacySelector;
  let selectionSource = legacySelectorAllowed ? "legacy" : "router";
  const isTrivial = classification === "trivial" || mode === "FAST";
  const isArch = classification === "architectural" || mode === "STRICT";

  /** @type {AdmissionItem[]} */
  const admissionItems = [];
  // Estados finales por skill (A): SELECTED|ADMITTED|INJECTED|TRUNCATED|OMITTED
  // con causa. Se llena en el bloque N3 skills y se expone en el return.
  const skillStates = [];

  const reserve = (level, text, admission = ADMISSION.MANDATORY, reason = "required") => {
    // MANDATORY items bypass budget limits — never truncated, never dropped.
    // They are guaranteed to be present in the pack regardless of budget.
    const t = estTokens(text);
    levels[level].push(text);
    admissionItems.push({ level, admission, reason, tokenCost: t, text });
    if (typeof globalThis.__wamReserveLines !== "undefined") {
      globalThis.__wamReserveLines.push({ level, text });
    }
    return t;
  };

  const spend = (level, text, admission = ADMISSION.OPTIONAL, reason = "context") => {
    const t = estTokens(text);
    admissionItems.push({ level, admission, reason, tokenCost: t, text });
    if (t > flex) {
      rationale.push(`${level}: excede presupuesto (${t} tok, restante ${flex})`);
      return 0;
    }
    levels[level].push(text);
    flex -= t;
    return t;
  };

  /** Drop CONDITIONAL items first, then OPTIONAL, to free budget for MANDATORY. */
  const dropByAdmission = (minAdmission) => {
    const order = [ADMISSION.CONDITIONAL, ADMISSION.OPTIONAL];
    const minIdx = order.indexOf(minAdmission);
    // minAdmission=MANDATORY → drop everything below MANDATORY (both CONDITIONAL and OPTIONAL).
    // indexOf returns -1 for MANDATORY, so clamp to 0 to include the full order.
    const droppable = order.slice(Math.max(0, minIdx));

    let freed = 0;
    for (const admission of droppable) {
      const items = admissionItems.filter((i) => i.admission === admission && levels[i.level].includes(i.text));
      for (const item of items) {
        const idx = levels[item.level].indexOf(item.text);
        if (idx !== -1) {
          levels[item.level].splice(idx, 1);
          flex += item.tokenCost;
          freed += item.tokenCost;
          rationale.push(`admission: dropped ${item.level} (${admission}) — ${item.reason}`);
        }
      }
    }
    return freed;
  };

  // -- N0 Global/Policy (MANDATORY) -----------------------------------------
  const n0Text = "[wam N0 policy] autonomy loop | soft-archive only (U1)";
  const n0Spent = reserve("N0", n0Text, ADMISSION.MANDATORY, "global policy");

  // -- N2 Task (reservado, obligatorio) -------------------------------------
  const liveFile = path.join(projectPath, ".wam", "tasks", taskId, "context.md");
  let liveBody = "";
  try {
    if (fs.existsSync(liveFile)) liveBody = fs.readFileSync(liveFile, "utf-8").trim();
  } catch {}
  if (taskState) {
    const reqs = taskState.requirements || [];
    const pend = reqs.filter((r) => r.status !== "done" && r.status !== "verified").length;
    const nextActionTruncated = (taskState.nextAction || "—").slice(0, 80);
    liveBody = [
      `task: ${taskId} — ${taskState.phase} / ${taskState.contract?.status || "?"}`,
      `req: ${pend}/${reqs.length} pend | next: ${nextActionTruncated}`,
    ].join("\n") || liveBody;
  }
  const n2Head = liveBody ? `[wam N2 task]\n${liveBody}` : "";
  const n2TaskSpent = n2Head ? reserve("N2", n2Head, ADMISSION.MANDATORY, "live task state") : 0;
  let reserved = n0Spent + n2TaskSpent;

  // Cognitive state injection (compact, only if cognition exists) - also conditional, but handled by router
  const cognitionRaw = loadCognitiveState(projectPath);
  const hasCognition =
    cognitionRaw.activeHypotheses.length > 0 ||
    cognitionRaw.rejectedHypotheses.length > 0 ||
    cognitionRaw.recentExperiments.length > 0 ||
    cognitionRaw.criticalObservations.length > 0;
  if (hasCognition) {
    const compact = compactCognitiveState(cognitionRaw);
    const cogText = `[wam N2 cognition] ${JSON.stringify(compact)}`;
    const cogTokens = estTokens(cogText);
    // Cognition is CONDITIONAL — can be dropped if budget is tight, but router should have accounted for this
    admissionItems.push({ level: "N2", admission: ADMISSION.CONDITIONAL, reason: "cognitive state", tokenCost: cogTokens, text: cogText });
    reserved += cogTokens;
    levels.N2.push(cogText);
  }
  const budget_violation = reserved > budget;
  let flex = Math.max(0, budget - reserved);
  if (budget_violation) {
    rationale.push(`VIOLACIÓN: Reserva N0+N2 (${reserved}) excede budget (${budget})`);
    // Admission policy: try to drop OPTIONAL and CONDITIONAL items to make room
    const freed = dropByAdmission(ADMISSION.MANDATORY);
    if (freed > 0) {
      rationale.push(`admission: freed ${freed} tokens by dropping non-MANDATORY items`);
    }
    // Recalculate flex after dropping items
    flex = Math.max(0, budget - reserved);
  }

  // -- Continuation: solo N2 (ya reservado y emitido) -----------------------
  if (!continuation) {
    // -- N1 Project (selectivo por dominio, consume flex) -------------------
    const ctx = getOperationalContext(projectPath);
    const recent = ctx.recentChanges?.body || "";
    // Recent changes are only relevant when their scope/content overlaps the
    // task. An unrelated task must not inherit unrelated operational history.
    const recentSummary = recent
      .split(/^## /m)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => taskTokens.length === 0 || overlap(taskTokens, tokenize(s)) > 0)
      .slice(0, 3)
      .join("\n# ");
    if (!isTrivial) {
      // N1 solo si hay memoria operacional real — cero líneas vacías (rigor = ahorro de tokens)
      const n1summary = summarizeOperationalContext(projectPath);
      if (n1summary) spend("N1", `[wam N1 project] ${n1summary}`, ADMISSION.CONDITIONAL, "project context");
      if (recentSummary) spend("N1", `[wam N1 recent] ${recentSummary.slice(0, 500)}`, ADMISSION.CONDITIONAL, "recent changes");

      // Provenance: inferido ≠ hecho
      for (const [key, label] of [["project", "project.md"], ["architecture", "architecture.md"], ["decisions", "decisions.md"], ["constraints", "constraints.md"]]) {
        const meta = ctx[key]?.meta || {};
        const conf = normalizeConfidence(meta.confidence);
        if (meta.source === "inferred" && conf < 0.4) {
          spend("N1", `[wam N1 WARNING] ${label} es INFERIDO (conf ${meta.confidence} ${confidenceLabel(conf)}) — no es decisión confirmada; validar antes de asumir`, ADMISSION.CONDITIONAL, "provenance warning");
        }
      }      
      const archDoc = ctx.architecture?.body || "";
      if (isArch && archDoc.trim()) {
        const arch = extractRelevantSections("architecture", archDoc, taskTokens, { base: true });
        if (arch.trim()) spend("N1", `[wam N1 architecture] ${arch.slice(0, 600)}`, ADMISSION.CONDITIONAL, "architecture context");
      }
      const projectDecisionsText = extractRelevantSections("decisions", ctx.decisions?.body || "", taskTokens, { base: false });
      if (projectDecisionsText.trim()) spend("N1", `[wam N1 decisions] ${projectDecisionsText.slice(0, 600)}`, ADMISSION.CONDITIONAL, "decisions context");
      const projectConstraintsText = extractRelevantSections("constraints", ctx.constraints?.body || "", taskTokens, { base: isArch });
      if (projectConstraintsText.trim()) spend("N1", `[wam N1 constraints] ${projectConstraintsText.slice(0, 400)}`, ADMISSION.CONDITIONAL, "constraints context");
    }

    // -- N3 Session (Context Router is canonical authority) -----------------
    // C02: Router is the sole canonical selector. Legacy selector is opt-in
    // via WAM_CONTEXT_SELECTOR=legacy in env/options. If router cannot resolve
    // or returns insufficient without the legacy flag, surface insufficiency —
    // do NOT silently swap to it.
if (!isTrivial) {
      // Canonical primary source: context-graph-builder.buildContextGraph
      // provides the base task/requirement/evidence nodes. The runtime
      // builder then LAYERS on the additional state slices (decisions,
      // constraints, artifacts, observations, cognition, hypotheses,
      // experiments) by delegating to buildContextGraph for the base.
      // This keeps context-graph-builder.js as the single source of truth
      // for the canonical node/edge schema while preserving full coverage.
      // The active task id may live on the assembly options rather than on the
      // taskState payload. Normalize it so the router graph is anchored on the
      // real task node instead of degrading to a fallback.
      const effectiveTaskState = taskState
        ? { ...taskState, taskId: taskState.taskId || taskId }
        : (taskId ? { taskId } : taskState);
      const graph = buildRuntimeContextGraph({
        taskState: effectiveTaskState,
        runState,
        evidenceLineage,
        cognitionState,
        decisions,
        constraints,
        artifacts,
        observations,
        hypotheses,
        experiments,
      });
      const routerPkg = routeAndAdapt(graph, {
        taskId: effectiveTaskState?.taskId,
        budget: flex,
        root: projectPath,
        promptTokens: taskTokens,
      });

      // C02: Router is canonical authority. Legacy only if explicitly requested.
      let pkg;
      if (routerPkg.source === "router" && routerPkg.capsules.length > 0) {
        pkg = routerPkg;
        selectionSource = "router";
        routerSufficiency = pkg.sufficiency || null;
        rationale.push("N3: using Context Router for selection");
      } else if (legacySelectorAllowed) {
        pkg = selectContext(prompt, { budget: flex, root: projectPath, sessionId: getSessionId(projectPath) });
        selectionSource = "legacy";
        routerSufficiency = "insufficient";
        rationale.push("N3: using legacy selector (explicit WAM_CONTEXT_SELECTOR=legacy)");
      } else {
        pkg = {
          ...routerPkg,
          capsules: routerPkg.capsules || [],
          sufficiency: routerPkg.sufficiency || "insufficient",
          omitted: routerPkg.omitted || [],
          missing: routerPkg.missing || [],
          contract: routerPkg.contract || null,
        };
        selectionSource = "router";
        routerSufficiency = "insufficient";
        rationale.push("N3: router returned insufficient — no legacy fallback without WAM_CONTEXT_SELECTOR=legacy");
      }

      // Capsule store enrichment: the Context Router selects graph nodes while
      // the Context Selection Engine (context.js) selects persisted capsules.
      // Both feed N3; dedupe by context_id. The router stays the sufficiency
      // authority (C02) — this is not a selector fallback.
      if (selectionSource !== "legacy") {
        const capsulePkg = selectContext(prompt, {
          budget: flex,
          root: projectPath,
          sessionId: getSessionId(projectPath),
        });
        const merged = [];
        for (const c of pkg.capsules || []) {
          // The active task is already emitted as the mandatory N2 line;
          // re-listing it under N3 is duplication, not supporting context.
          if (c.context_id === effectiveTaskState?.taskId) continue;
          if (!merged.some((m) => m.context_id === c.context_id)) merged.push(c);
        }
        for (const c of capsulePkg.capsules || []) {
          if (!merged.some((m) => m.context_id === c.context_id)) merged.push(c);
        }
        pkg = { ...pkg, capsules: merged };
      }

      const emitCapsule = (c) => {
        const head = `[wam N3 ${c.level || "N3"} ${c.provenance}] ${c.context_id} — ${(c.purpose || "").slice(0, 100)}`;
        const contentMax = 800;
        const truncated = (c.content || "").length > contentMax
          ? c.content.slice(0, contentMax) + `...[truncado: ver /wam ctx get ${c.context_id}]`
          : (c.content || "");
        const line = truncated ? `${head}\n  content: ${truncated.replace(/\n+/g, " ").slice(0, contentMax)}` : head;
        spend("N3", line, ADMISSION.OPTIONAL, `capsule ${c.context_id} (${selectionSource})`);
      };

      // Split requirement-derived capsules from everything else. Requirement
      // nodes are MANDATORY in the router, so a task with many requirements
      // yields one capsule each; emitting them all is duplication of the N2
      // summary. Above MAX_VISIBLE_REQS, consolidate into a single count line.
      const requirementCapsules = (pkg.capsules || []).filter(isRequirementCapsule);
      const otherCapsules = (pkg.capsules || []).filter((c) => !isRequirementCapsule(c));

      for (const c of otherCapsules) emitCapsule(c);

      if (requirementCapsules.length > MAX_VISIBLE_REQS) {
        spend(
          "N3",
          `[wam N3 requirements] ${requirementCapsules.length} reqs consolidados — ver /wam req list`,
          ADMISSION.OPTIONAL,
          "requirement capsule consolidation"
        );
      } else {
        for (const c of requirementCapsules) emitCapsule(c);
      }

      // Router mandatory omissions: explicitly report as admission failures, never silently drop
      for (const omitted of pkg.omitted || []) {
        if (omitted.admission === ADMISSION.MANDATORY) {
          rationale.push(`admission: MANDATORY omitted by router — ${omitted.id}: ${omitted.reason}`);
        }
      }

      if (pkg.sufficiency === "insufficient") {
        rationale.push(`N3: sufficiency insufficient — faltan ${pkg.missing.join(", ")}`);
        const conditions = pkg.contract?.conditions || [];
        const contractReport = conditions
          .filter((c) => c.status !== "SATISFIED" && c.severity === "MANDATORY")
          .map((c) => `  - [${c.id}] ${c.type}: ${c.description} (${c.status})`)
          .join("\n");
        spend("N3", `[wam N3 warning] contexto insuficiente:\n${contractReport}\n/wam ctx get <q>`, ADMISSION.MANDATORY, "sufficiency warning");
      }
    }

// -- N3 Skills (contenido de skills seleccionadas, consume flex) ---------
    // Inyecta el contenido real de las skills seleccionadas para que el agente
    // respete las restricciones y patrones de cada skill (layer responsibility).
    // Lee directamente del registry sin importar engine.js (evita circular import).
    //
    // Política explícita del primer mensaje (B):
    //  - isTrivial o mode === "FAST" NO excluyen skills base obligatorias; sí
    //    suprimen on-demand cuando el usuario pidió respuesta rápida.
    //  - El caller puede pasar `taskState` con phase === "ASKING" para indicar
    //    respuesta de aclaración; en ese caso NO se inyecta nada (estado ASKING
    //    ≠ estado de ejecución; se reporta skillStates con OMITTED por causa).
    const admissionGate = (skill) => {
      if (!skill.base && (isTrivial || mode === "FAST")) {
        return { allowed: false, cause: "trivial-fast" };
      }
      return { allowed: true };
    };

    if (skillRegistry && selectedSkills.length > 0) {
      // Fase de selección: marca SELECTED a cada candidato antes del budget gate.
      const prepared = selectedSkills.map((s) => {
        const gate = admissionGate(s);
        const state = {
          id: s.id,
          name: s.name || s.id,
          base: !!s.base,
          relevance: s.relevance || 0,
          reason: s.reason || "",
          state: gate.allowed ? "SELECTED" : "OMITTED",
          cause: gate.allowed ? null : gate.cause,
          tokenCost: 0,
          truncated: false,
        };
        skillStates.push(state);
        return { skill: s, state, gate };
      }).filter((p) => p.gate.allowed);

      // Fast path: respuesta de aclaración no ejecuta → no se inyecta nada.
      if (taskState && taskState.phase === "ASKING") {
        for (const p of prepared) {
          // Permanece en SELECTED; se rechaza inyectar porque el handler
          // retornó antes de llamar al ensamblador en el primer mensaje.
          p.state.cause = p.state.cause || "asking-clarification";
        }
      } else {
        const skillBudget = Math.floor(flex * 0.4); // 40% del flex restante para skills
        let skillSpent = 0;

        // Prioritize prompt-matched (on-demand) skills over always-on base skills so
        // a tight budget never starves the task-relevant skills. Base skills only
        // inject if budget remains after the matched ones.
        const ordered = [...prepared].sort((a, b) => {
          const ab = a.skill.base ? 1 : 0;
          const bb = b.skill.base ? 1 : 0;
          if (ab !== bb) return ab - bb;
          return (b.skill.relevance || 0) - (a.skill.relevance || 0);
        });

        for (const { skill, state } of ordered) {
          const skillContentMax = skill.base ? 8000 : 1200; // max chars por skill
          if (skillSpent >= skillBudget) {
            state.state = "OMITTED";
            state.cause = "skill-budget-exhausted";
            rationale.push(`N3: budget agotado para skills (${skillSpent}/${skillBudget})`);
            break;
          }

          const skillData = skillRegistry[skill.id];
          if (!skillData) {
            state.state = "OMITTED";
            state.cause = "not-in-registry";
            rationale.push(`N3: ${skill.id} no encontrada en registry`);
            continue;
          }

          const content = skillData.content || "";
          if (!content.trim()) {
            state.state = "OMITTED";
            state.cause = "no-content";
            rationale.push(`N3: ${skill.id} sin contenido embebido`);
            continue;
          }

          // D: preservar estructura Markdown del contenido (no aplanar saltos).
          // Si excede skillContentMax, priorizar secciones relevantes (heading-
          // based pruning) antes de truncar el cuerpo.
          let finalContent = content;
          let truncated = false;
          if (content.length > skillContentMax) {
            finalContent = pruneBySection(content, skillContentMax, skill.reason || "");
            truncated = true;
          }

          const head = `[wam N3 skill] ${skill.id} — ${(skill.reason || "").slice(0, 100)}`;
          const line = `${head}\n${finalContent}`;
          const skillAdmission = skill.base ? ADMISSION.OPTIONAL : ADMISSION.CONDITIONAL;
          const cost = spend("N3", line, skillAdmission, `skill ${skill.id}`);
          if (cost === 0) {
            // spend() rechazó por presupuesto global; el contenido no entró al pack.
            state.state = "OMITTED";
            state.cause = "flex-budget-exhausted";
            state.tokenCost = 0;
            state.truncated = false;
            rationale.push(`N3: ${skill.id} omitida por presupuesto global (flex agotado)`);
            continue;
          }
          state.state = truncated ? "TRUNCATED" : "INJECTED";
          state.cause = truncated ? "section-pruned" : null;
          state.tokenCost = cost;
          state.truncated = truncated;
          skillSpent += cost;
          rationale.push(`N3: ${skill.id} ${state.state.toLowerCase()} (${cost} tok, reason: ${skill.reason})`);
        }
      }
      }
    }

  const designCategories = classifyDesignTask(prompt);
  let designBudgetLine = "";
  if (designCategories && designCategories.length > 0) {
    const designCtx = loadDesignContext(projectPath);
    const primaryCategory = designCategories[0];
    const selectedRefs = ["tokens.md", "components.md"];
    const excludedRefs = ["dashboard", "navigation"];
    const designTokens = estTokens(designCtx.content || "") + 150;
    if (designTokens <= flex) {
      flex -= designTokens;
      designBudgetLine = `[wam design budget] selected=${selectedRefs.join(",")} excluded=${excludedRefs.join(",")} tokens=${designTokens} reason=${primaryCategory}`;
      if (designCtx.content) {
        levels.N3.push(`[wam design context]\n${designCtx.content.slice(0, 1500)}`);
      }
    } else {
      designBudgetLine = `[wam design budget] selected=${selectedRefs.join(",")} excluded=${excludedRefs.join(",")} tokens=0 reason=${primaryCategory} (exceeded flex)`;
    }
  }

  const lines = [...levels.N0, ...levels.N1, ...levels.N2, ...levels.N3];
  if (designBudgetLine) {
    lines.push(designBudgetLine);
  }

  try {
    const { recordTokenSavings } = await import("../verification/token-savings-meter.js");
    const promptTokens = estTokens(prompt || "");
    const actualTokens = lines.reduce((sum, line) => sum + estTokens(line), 0);
    const historyTokens = estTokens(lines.join(""));
    recordTokenSavings(projectPath, taskId || "unknown", actualTokens, promptTokens, historyTokens);
  } catch {}

  // Admission report — Router is canonical authority for sufficiency when available.
  const mandatoryItems = admissionItems.filter((i) => i.admission === ADMISSION.MANDATORY);
  const mandatoryTokens = mandatoryItems.reduce((sum, i) => sum + i.tokenCost, 0);

  let sufficiency;
  if (routerSufficiency) {
    sufficiency = routerSufficiency === "ok" ? "sufficient" : "insufficient";
  } else if (budget_violation && mandatoryTokens > budget) {
    sufficiency = "insufficient";
  } else {
    sufficiency = "sufficient";
  }

  // Instrumentation: record assembly metrics
  if (collector) {
    collector.record("Context_assembled");
    collector.set("Mandatory_items", admissionItems.filter((i) => i.admission === ADMISSION.MANDATORY).length);
    collector.set("Conditional_items", admissionItems.filter((i) => i.admission === ADMISSION.CONDITIONAL).length);
    collector.set("Optional_items", admissionItems.filter((i) => i.admission === ADMISSION.OPTIONAL).length);
    collector.set("Tokens_before", admissionItems.reduce((sum, i) => sum + i.tokenCost, 0));
    collector.set("Tokens_after", lines.reduce((sum, line) => sum + estTokens(line), 0));
  }

  // -- Integrity gate (post-emission recompute) -----------------------------
  // Recompute metrics AFTER `lines` is finalized so values reflect what was
  // actually emitted, not pre-reservation estimates. Admission is preserved
  // (MANDATORY items are always emitted; OPTIONAL/CONDITIONAL may be dropped).
  const emittedAdmissionItems = admissionItems.filter((it) => {
    return lines.some((line) => line === it.text);
  });

  const selectedCount = admissionItems.length;
  const emittedCount = emittedAdmissionItems.length;
  const omittedCount = Math.max(0, selectedCount - emittedCount);
  const emittedMandatorySet = new Set(
    emittedAdmissionItems.filter((i) => i.admission === ADMISSION.MANDATORY).map((i) => i.text)
  );
  const allMandatorySet = new Set(
    admissionItems.filter((i) => i.admission === ADMISSION.MANDATORY).map((i) => i.text)
  );
  const mandatoryOmissions = [];
  for (const t of allMandatorySet) {
    if (!emittedMandatorySet.has(t)) mandatoryOmissions.push(t);
  }

  // Unresolved dependencies: any rationale line tagged with "depends on" / "missing"
  // dependency, OR any MANDATORY omission (mandatory items are required
  // dependencies by construction).
  const unresolvedDependencies = [];
  for (const r of rationale) {
    if (
      typeof r === "string" &&
      (r.includes("MANDATORY omitted by router") ||
        r.includes("missing dependency") ||
        r.startsWith("admission: dependency"))
    ) {
      unresolvedDependencies.push(r);
    }
  }
  for (const t of mandatoryOmissions) {
    if (!unresolvedDependencies.includes(t)) unresolvedDependencies.push(t);
  }

  // Final sufficiency verdict (post-emission): insufficient iff we have
  // mandatory omissions, unresolved mandatory dependencies, or the router
  // already flagged sufficiency === "insufficient".
  const integrityFailures = [];
  if (mandatoryOmissions.length > 0) {
    integrityFailures.push(`${mandatoryOmissions.length} MANDATORY item(s) omitted from emission`);
  }
  if (sufficiency === "insufficient") {
    integrityFailures.push("router reported insufficient context");
  }
  if (budget_violation && selectedCount > emittedCount) {
    integrityFailures.push("budget violation with admitted items dropped");
  }
  const finalSufficiency =
    integrityFailures.length === 0 && (selectedCount === 0 || emittedCount > 0) ? "sufficient" : "insufficient";

  const integrity = {
    selectedCount,
    emittedCount,
    omittedCount,
    mandatoryOmissions,
    unresolvedDependencies,
    finalSufficiency,
    integrityFailures,
  };

  return {
    levels: Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, v.length])),
    lines,
    budget_used: budget - flex,
    budget,
    budget_violation,
    reserved,
    flex,
    rationale,
    continuation,
    source: selectionSource || "legacy",
    skillStates,
    admission: {
      sufficiency,
      mandatoryCount: mandatoryItems.length,
      mandatoryTokens,
      droppedItems: rationale.filter((r) => r.startsWith("admission: dropped")),
    },
    integrity,
  };
}

export { estimateCapsuleTokens, ADMISSION };