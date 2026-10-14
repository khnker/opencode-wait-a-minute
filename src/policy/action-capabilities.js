/**
 * Action Capabilities — Structured classification of agent tool capabilities.
 *
 * Define cuatro niveles de capacidad, cada uno con un significado explícito
 * respecto a mutación, autorización y fail-mode:
 *
 *   - SAFE     : read-only / efectos reversibles mínimos. Autónoma.
 *   - GUARDED  : mutaciones bounded y reversibles. Autónoma si está dentro del scope.
 *   - BLOCKED  : destructivo, irreversible o sensible. Requiere autorización explícita.
 *   - UNKNOWN  : la herramienta no aparece en el catálogo. Fail-closed (treated as BLOCKED).
 *
 * Implementa: action-risk-envelope / C01 fail-closed (scoped).
 *
 * SCOPE BOUNDARY: el action-risk-envelope gobierna únicamente acciones con blast
 * radius sobre el repositorio/proyecto. Las tools de runtime/meta del agente que
 * no mutan el repositorio (`compress`, `delegate_task`, `call_agent`) quedan FUERA
 * del envelope: hacen bypass total y NUNCA se bloquean (ver OUT_OF_SCOPE_TOOLS).
 *
 * Dentro del dominio gobernado la política es fail-closed: cualquier herramienta
 * que no aparezca explícitamente en SAFE/GUARDED/BLOCKED se clasifica como UNKNOWN
 * y se trata como BLOCKED. Las tools MCP de Playwright/browser — demasiado
 * numerosas para enumerarlas una a una — se clasifican por verbo
 * (ver `classifyMcpVerb`).
 */

export const CAPABILITY_LEVELS = Object.freeze({
  SAFE: "SAFE",
  GUARDED: "GUARDED",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN",
});

/**
 * Meta/runtime tools fuera del scope del action-risk-envelope: no mutan el
 * repositorio y deben hacer bypass de la clasificación fail-closed (nunca se
 * bloquean).
 */
export const OUT_OF_SCOPE_TOOLS = Object.freeze(
  new Set(["compress", "delegate_task", "call_agent"]),
);

/**
 * Mapa explícito de capacidades por nombre de herramienta.
 * Cualquier herramienta que NO esté aquí se clasifica como UNKNOWN
 * (y, dentro del dominio gobernado, se trata como BLOCKED).
 */
export const ACTION_CAPABILITIES = Object.freeze({
  // --- SAFE: read-only / sin efectos ---
  read:        CAPABILITY_LEVELS.SAFE,
  glob:        CAPABILITY_LEVELS.SAFE,
  grep:        CAPABILITY_LEVELS.SAFE,
  ls:          CAPABILITY_LEVELS.SAFE,
  tool_search: CAPABILITY_LEVELS.SAFE,
  tool_search_regex: CAPABILITY_LEVELS.SAFE,
  webfetch:    CAPABILITY_LEVELS.SAFE,
  fetch:       CAPABILITY_LEVELS.SAFE,
  question:    CAPABILITY_LEVELS.SAFE,

  // --- GUARDED: mutaciones bounded ---
  write:       CAPABILITY_LEVELS.GUARDED,
  edit:        CAPABILITY_LEVELS.GUARDED,
  apply_patch: CAPABILITY_LEVELS.GUARDED,
  patch:       CAPABILITY_LEVELS.GUARDED,
  todo_write:  CAPABILITY_LEVELS.GUARDED,
  todowrite:   CAPABILITY_LEVELS.GUARDED,
  bash:        CAPABILITY_LEVELS.GUARDED,
  sh:          CAPABILITY_LEVELS.GUARDED,
  pty_spawn:   CAPABILITY_LEVELS.GUARDED,
  pty_write:   CAPABILITY_LEVELS.GUARDED,
  task:        CAPABILITY_LEVELS.GUARDED, // delegation: GUARDED, not SAFE

  // --- BLOCKED: destructivo / sensible ---
  rm:          CAPABILITY_LEVELS.BLOCKED,
  rmdir:       CAPABILITY_LEVELS.BLOCKED,
  mv:          CAPABILITY_LEVELS.BLOCKED,
  sudo:        CAPABILITY_LEVELS.BLOCKED,
  chmod:       CAPABILITY_LEVELS.BLOCKED,
  chown:       CAPABILITY_LEVELS.BLOCKED,
  docker:      CAPABILITY_LEVELS.BLOCKED,
  ssh:         CAPABILITY_LEVELS.BLOCKED,
  scp:         CAPABILITY_LEVELS.BLOCKED,
  rsync:       CAPABILITY_LEVELS.BLOCKED,
  push:        CAPABILITY_LEVELS.BLOCKED,
  force_push:  CAPABILITY_LEVELS.BLOCKED,
});

// ---------------------------------------------------------------------------
// MCP (Playwright/browser) verb fallback
// ---------------------------------------------------------------------------

/** Nombres de tools MCP: `playwright_*` o `browser_*`. */
const MCP_TOOL_PATTERN = /^(playwright|browser)[_:-]/;

/** Verbos destructivos/irreversibles → BLOCKED. */
const MCP_BLOCKED_VERBS = new Set([
  "evaluate", "eval", "execute", "exec", "unsafe", "inject", "code",
]);

/** Verbos de mutación bounded → GUARDED. */
const MCP_GUARDED_VERBS = new Set([
  "click", "dblclick", "tap", "set", "type", "fill", "press", "select",
  "check", "uncheck", "hover", "drag", "drop", "upload", "write", "delete",
  "clear", "submit", "choose", "focus", "insert", "remove", "add",
]);

/** Verbos read-only / sin efectos → SAFE. */
const MCP_SAFE_VERBS = new Set([
  "reload", "navigate", "forward", "back", "get", "read", "snapshot",
  "screenshot", "wait", "close", "list", "go", "pdf", "console", "network",
  "tab", "find", "search",
]);

function tokensOf(tool) {
  return tool.split(/[^a-z0-9]+/).filter(Boolean);
}

function classifyMcpVerb(normalized) {
  const tokens = tokensOf(normalized);
  if (tokens.some((t) => MCP_BLOCKED_VERBS.has(t))) return CAPABILITY_LEVELS.BLOCKED;
  if (tokens.some((t) => MCP_GUARDED_VERBS.has(t))) return CAPABILITY_LEVELS.GUARDED;
  if (tokens.some((t) => MCP_SAFE_VERBS.has(t))) return CAPABILITY_LEVELS.SAFE;
  return null;
}

/**
 * Resuelve la capacidad explícita de una herramienta por nombre exacto.
 * No hace coincidencia por sub-string ni por prefijo — debe ser match exacto.
 *
 * Esto evita la colisión por sub-string: "bash-safe" no debe resolverse a "bash".
 *
 * Para tools MCP de Playwright/browser aplica el fallback por verbo.
 *
 * @param {string} tool — nombre de la herramienta (case-insensitive).
 * @returns {"SAFE"|"GUARDED"|"BLOCKED"|"UNKNOWN"}
 */
export function getCapability(tool) {
  if (typeof tool !== "string" || tool.length === 0) {
    return CAPABILITY_LEVELS.UNKNOWN;
  }
  const normalized = tool.toLowerCase();
  const cap = ACTION_CAPABILITIES[normalized];
  if (cap) return cap;
  if (MCP_TOOL_PATTERN.test(normalized)) {
    const verbCap = classifyMcpVerb(normalized);
    if (verbCap) return verbCap;
  }
  return CAPABILITY_LEVELS.UNKNOWN;
}

/**
 * Resuelve la capacidad efectiva aplicando fail-closed scoped:
 *   - Meta/runtime tools en OUT_OF_SCOPE_TOOLS → SAFE (bypass; nunca bloqueadas).
 *   - UNKNOWN dentro del dominio gobernado → BLOCKED.
 *
 * Esta es la función que el risk-engine debe usar.
 *
 * @param {string} tool
 * @returns {"SAFE"|"GUARDED"|"BLOCKED"}
 */
export function getEffectiveCapability(tool) {
  if (typeof tool === "string" && OUT_OF_SCOPE_TOOLS.has(tool.toLowerCase())) {
    return CAPABILITY_LEVELS.SAFE;
  }
  const cap = getCapability(tool);
  if (cap === CAPABILITY_LEVELS.UNKNOWN) {
    return CAPABILITY_LEVELS.BLOCKED;
  }
  return cap;
}

/**
 * ¿Es una herramienta mutante? (GUARDED o BLOCKED; UNKNOWN incluido por fail-closed).
 *
 * @param {string} tool
 * @returns {boolean}
 */
export function isMutatingCapability(tool) {
  const eff = getEffectiveCapability(tool);
  return eff === CAPABILITY_LEVELS.GUARDED || eff === CAPABILITY_LEVELS.BLOCKED;
}
