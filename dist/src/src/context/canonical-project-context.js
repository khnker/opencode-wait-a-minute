/**
 * Canonical Project Context (CPC) — grounding canónico del proyecto, inyectado al iniciar tareas.
 *
 * OpenSpec change: add-canonical-project-context
 *
 * Conceptos (canonical):
 *   Proyecto    — memoria estable del repo (identidad, stack, decisiones, constraints).
 *                 Sobrevive entre sesiones: es la única fuente admitida en el CPC.
 *   Sesión      — estado efímero (task state, transcript, capsules, N2/N3).
 *                 Prohibido dentro del CPC: mezclarlo contamina el contexto canónico.
 *
 *   Hechos verificados — statements observados o confirmados (Stack, Facts, Decisions, …).
 *   Supuestos          — statements inferidos o asumidos (Inferred, Assumed, Open Questions…).
 *                         Siempre rotulados; nunca se presentan como hecho.
 *
 * Presupuesto: el bloque renderizado MUST medir < CPC_TOKEN_BUDGET tokens.
 * Bajo presión se descartan primero los supuestos y, solo si no alcanza, se trunca un
 * hecho (queda marcado como truncado). El límite nunca se excede.
 *
 * Fuente de verdad: el memo canónico del proyecto (`.wam/context/project.md`),
 * leído por el ensamblador y construido acá. El CPC no escribe ni muta estado.
 */
import fs from "node:fs";
import path from "node:path";
import { countTokens } from "./tokenizer.js";
import { injectWamParts } from "../integration/part-provenance.js";

/** Límite duro de tokens del bloque CPC renderizado (exclusivo: tokens < 150). */
export const CPC_TOKEN_BUDGET = 150;

/** Marcador del bloque CPC (also idempotency key). */
export const CPC_MARKER = "[wam CPC]";

/** Ubicación canónica del memo de proyecto (base del wam root). */
export const CPC_MEMO_PATH = path.join(".wam", "context", "project.md");

/**
 * Fases en las que la tarea todavía no corre: el CPC se inyecta cuando la tarea
 * nace o está propuesta (PROPOSED). En cualquier otra fase la tarea ya está
 * en marcha y el CPC sería redundante.
 */
const CPC_INJECTABLE_PHASES = new Set(["PROPOSED"]);

/**
 * Registro de tareas que ya recibieron el CPC.
 * El CPC es orgánico: se inyecta UNA vez por tarea (al nacer), nunca en cada
 * mensaje de la misma tarea.
 */
const cpcInjectedTasks = new Map();

const HEADER = `${CPC_MARKER} canonical project context`;

/** Secciones cuyo contenido es un hecho verificado del proyecto. */
const VERIFIED_SECTIONS = new Set([
  "project",
  "project context",
  "stack",
  "facts",
  "fact",
  "verified",
  "decisions",
  "decision",
  "constraints",
  "constraint",
  "architecture",
  "conventions",
  "convention",
  "overview",
]);

/** Secciones cuyo contenido es un supuesto (no verificado). */
const ASSUMED_SECTIONS = new Set([
  "inferred",
  "inference",
  "assumed",
  "assumption",
  "assumptions",
  "hypotheses",
  "hypothesis",
  "provisional",
  "guesses",
  "open questions",
]);

/** Secciones de alcance de sesión o efímeras: nunca son canónicas. */
const NON_CANONICAL_SECTIONS =
  /session|task|conversation|transcript|chat|runtime|recent|history|ephemeral|capsule/i;

/** Marcadores de datos de sesión dentro del texto de una línea. */
const SESSION_CONTENT_MARKERS = [
  /session[\s_-]*id/i,
  /task[\s_-]*id/i,
  /task[\s_-]*state/i,
  /\[wam n[23]/i,
  /session\.log/i,
  /transcript/i,
];

/**
 * @typedef {Object} CpcEntry
 * @property {"fact"|"assumption"} kind
 * @property {string} text
 * @property {string} section
 * @property {string} source
 */

/**
 * Normaliza un encabezado de sección a su clave canónica.
 *
 * @param {string} raw
 * @returns {string}
 */
function normalizeSection(raw) {
  return String(raw || "")
    .replace(/[（(][^)）]*[)）]/g, " ")
    .replace(/[^a-z0-9? ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Clasifica una sección canónica.
 *
 * @param {string} section
 * @returns {"fact"|"assumption"|null} null = sección no canónica.
 */
function classifySection(section) {
  if (!section) return null;
  if (NON_CANONICAL_SECTIONS.test(section)) return null;
  if (VERIFIED_SECTIONS.has(section)) return "fact";
  if (ASSUMED_SECTIONS.has(section)) return "assumption";
  return null;
}

/**
 * Parsea el memo canónico del proyecto en entradas verificadas y supuestas.
 *
 * @param {string} doc
 * @param {string} source
 * @returns {{ entries: CpcEntry[], rejected: { text: string, section: string, reason: string }[] }}
 */
function parseDocument(doc, source) {
  const entries = [];
  const rejected = [];
  let section = "";
  for (const rawLine of String(doc || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      section = normalizeSection(heading[1]);
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (!bullet) continue;
    const text = bullet[1].trim();
    if (!text) continue;
    const kind = classifySection(section);
    if (!kind) {
      rejected.push({ text, section, reason: section ? "non-canonical section" : "no section" });
      continue;
    }
    if (SESSION_CONTENT_MARKERS.some((re) => re.test(text))) {
      rejected.push({ text, section, reason: "session-scoped content" });
      continue;
    }
    entries.push({ kind, text, section, source });
  }
  return { entries, rejected };
}

/**
 * Renderiza las entradas como bloque inyectable.
 *
 * @param {CpcEntry[]} entries
 * @returns {string}
 */
function renderEntries(entries) {
  if (!entries || !entries.length) return "";
  return [HEADER, ...entries.map((e) => `[wam CPC ${e.kind}] ${e.text}`)].join("\n");
}

/**
 * Construye el CPC desde el memo canónico del proyecto.
 *
 * @param {{ doc?: string, source?: string }} [params]
 * @returns {{
 *   version: number,
 *   budget: number,
 *   entries: CpcEntry[],
 *   dropped: (CpcEntry & { reason: string })[],
 *   rejected: { text: string, section: string, reason: string }[],
 *   truncated: boolean,
 * }}
 */
export function buildCanonicalProjectContext({ doc = "", source = "project.md" } = {}) {
  const { entries, rejected } = parseDocument(doc, source);
  const kept = entries.map((e) => ({ ...e }));
  const dropped = [];
  let truncated = false;

  // 1) los supuestos se descartan primero: son los menos canónicos.
  while (kept.length && countTokens(renderEntries(kept)) >= CPC_TOKEN_BUDGET) {
    const idx = kept.findLastIndex((e) => e.kind === "assumption");
    if (idx === -1) break;
    dropped.push({ ...kept[idx], reason: "budget" });
    kept.splice(idx, 1);
  }

  // 2) hechos menos canónicos primero: se conservan los primeros, enteros.
  while (kept.length && countTokens(renderEntries(kept)) >= CPC_TOKEN_BUDGET) {
    const idx = kept.findLastIndex((e) => e.kind === "fact");
    if (idx === -1 || kept.filter((e) => e.kind === "fact").length <= 1) break;
    dropped.push({ ...kept[idx], reason: "budget" });
    kept.splice(idx, 1);
  }

  // 3) último recurso: truncar el hecho más largo hasta entrar en presupuesto.
  let guard = 0;
  while (kept.length && guard++ < 40) {
    const tokens = countTokens(renderEntries(kept));
    if (tokens < CPC_TOKEN_BUDGET) break;
    const factIdx = kept.findIndex((e) => e.kind === "fact");
    if (factIdx === -1) break;
    const words = kept[factIdx].text.split(/\s+/).filter(Boolean);
    if (words.length <= 4) {
      dropped.push({ ...kept[factIdx], reason: "budget" });
      kept.splice(factIdx, 1);
      truncated = true;
      break;
    }
    const excess = tokens - (CPC_TOKEN_BUDGET - 1);
    const cut = Math.max(1, Math.min(words.length - 4, Math.ceil(excess / 2)));
    kept[factIdx] = { ...kept[factIdx], text: `${words.slice(0, words.length - cut).join(" ")} …` };
    truncated = true;
  }

  return {
    version: 1,
    budget: CPC_TOKEN_BUDGET,
    entries: kept,
    dropped,
    rejected,
    truncated,
  };
}

/**
 * Renderiza el CPC como bloque de texto inyectable.
 *
 * @param {object} cpc
 * @returns {string}
 */
export function renderCanonicalProjectContext(cpc) {
  return renderEntries(cpc?.entries || []);
}

/**
 * Valida el CPC: presupuesto de tokens y ausencia de datos de sesión.
 *
 * @param {object} cpc
 * @returns {{ valid: boolean, errors: string[], tokens: number }}
 */
export function validateCanonicalProjectContext(cpc) {
  const errors = [];
  const text = renderCanonicalProjectContext(cpc);
  const tokens = countTokens(text);
  if (tokens >= CPC_TOKEN_BUDGET) {
    errors.push(`token budget exceeded: ${tokens} >= ${CPC_TOKEN_BUDGET}`);
  }
  const marker = SESSION_CONTENT_MARKERS.find((re) => re.test(text));
  if (marker) {
    errors.push(`session data contamination: ${marker.source}`);
  }
  for (const entry of cpc?.entries || []) {
    if (entry.kind !== "fact" && entry.kind !== "assumption") {
      errors.push(`invalid entry kind: ${entry.kind}`);
    }
  }
  return { valid: errors.length === 0, errors, tokens };
}

/**
 * Prepara el CPC para inyección: construye, renderiza y valida en una sola llamada.
 *
 * @param {{ doc?: string, source?: string }} [params]
 * @returns {{ cpc: object, text: string, tokens: number, valid: boolean, errors: string[] }}
 */
export function prepareCanonicalProjectContext({ doc = "", source = "project.md" } = {}) {
  const cpc = buildCanonicalProjectContext({ doc, source });
  const text = renderCanonicalProjectContext(cpc);
  const check = validateCanonicalProjectContext(cpc);
  return { cpc, text, tokens: check.tokens, valid: check.valid, errors: check.errors };
}

/**
 * Lee el memo canónico del proyecto desde el wam root.
 *
 * @param {string} root
 * @returns {{ doc: string, source: string }}
 */
export function loadCanonicalProjectContext(root) {
  const source = CPC_MEMO_PATH.split(path.sep).join("/");
  if (!root) return { doc: "", source };
  try {
    const file = path.join(root, CPC_MEMO_PATH);
    if (!fs.existsSync(file)) return { doc: "", source };
    return { doc: fs.readFileSync(file, "utf-8"), source };
  } catch {
    return { doc: "", source };
  }
}

/**
 * Inyecta el CPC en la salida del hook cuando la tarea NACE (fase PROPOSED).
 *
 * Inyección orgánica — el CPC no se repite en cada mensaje:
 *   - sólo en el mensaje donde la tarea nace (`previousTaskId` !== `taskId`);
 *   - nunca en mensajes de continuación de la misma tarea;
 *   - una sola vez por tarea (registro `cpcInjectedTasks`), aunque el llamador
 *     insista;
 *   - si se conoce la fase, sólo cuando la tarea está propuesta (PROPOSED).
 *
 * Idempotente: si el bloque ya está presente en la salida, no se duplica.
 *
 * @param {{ parts?: any[], system?: any[] }} output
 * @param {{ root?: string, taskId?: string, messageID?: string, phase?: string, previousTaskId?: string }} [params]
 * @returns {{ injected: boolean, reason?: string, tokens?: number }}
 */
export function injectCanonicalProjectContext(output, { root, taskId, messageID, phase, previousTaskId } = {}) {
  if (!taskId) return { injected: false, reason: "no active task" };
  if (previousTaskId && previousTaskId === taskId) {
    return { injected: false, reason: "continuation message" };
  }
  if (phase && !CPC_INJECTABLE_PHASES.has(String(phase).trim().toUpperCase())) {
    return { injected: false, reason: `task phase ${phase}` };
  }
  if (cpcInjectedTasks.has(taskId)) return { injected: false, reason: "already injected" };
  const { doc, source } = loadCanonicalProjectContext(root);
  const prepared = prepareCanonicalProjectContext({ doc, source });
  if (!prepared.text) return { injected: false, reason: "no canonical project content" };
  if (!prepared.valid) return { injected: false, reason: prepared.errors.join("; ") };
  const sink = Array.isArray(output?.parts)
    ? output.parts
    : Array.isArray(output?.system)
      ? output.system
      : null;
  if (!sink) return { injected: false, reason: "no output sink" };
  if (sink.some((p) => typeof p?.text === "string" && p.text.includes(CPC_MARKER))) {
    return { injected: false, reason: "already injected", tokens: prepared.tokens };
  }
  injectWamParts(output, prepared.text, { messageID, phase: "cpc", position: "append" });
  return { injected: true, tokens: prepared.tokens };
}
