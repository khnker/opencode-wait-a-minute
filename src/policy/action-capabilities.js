/**
 * Action Capabilities — Structured classification of agent tool capabilities.
 *
 * Principio de diseño: WAM protege exclusivamente contra operaciones
 * destructivas o peligrosas explícitamente definidas.
 *
 * Las herramientas no catalogadas por defecto son SAFE, permitiendo
 * que runtime del agente, MCPs y herramientas de terceros operen
 * sin fricción innecesaria. Solo se bloquean las operaciones
 * explícitamente peligrosas listadas en BLOCKED.
 */

export const CAPABILITY_LEVELS = Object.freeze({
  SAFE: "SAFE",
  GUARDED: "GUARDED",
  BLOCKED: "BLOCKED",
  UNKNOWN: "UNKNOWN", // Retained for completeness but no longer used in practice
});

/**
 * Mapa explícito de capacidades por nombre de herramienta.
 * Las herramientas no listadas se tratan como SAFE por defecto.
 */
export const ACTION_CAPABILITIES = Object.freeze({
  // --- SAFE: read-only / sin efectos ---
  read:        CAPABILITY_LEVELS.SAFE,
  glob:        CAPABILITY_LEVELS.SAFE,
  grep:        CAPABILITY_LEVELS.SAFE,
  ls:          CAPABILITY_LEVELS.SAFE,
  tool_search: CAPABILITY_LEVELS.SAFE,
  webfetch:    CAPABILITY_LEVELS.SAFE,
  fetch:       CAPABILITY_LEVELS.SAFE,
  compress:    CAPABILITY_LEVELS.SAFE,
  question:    CAPABILITY_LEVELS.SAFE,
  tool_search_regex: CAPABILITY_LEVELS.SAFE,

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
  task:        CAPABILITY_LEVELS.GUARDED,
  delegate_task: CAPABILITY_LEVELS.GUARDED,
  call_agent:    CAPABILITY_LEVELS.GUARDED,

  // --- BLOCKED: destructivo / sensible (únicas bloqueadas por defecto) ---
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

export function getCapability(tool) {
  if (typeof tool !== "string" || tool.length === 0) {
    return CAPABILITY_LEVELS.SAFE;
  }
  const normalized = tool.toLowerCase();
  return ACTION_CAPABILITIES[normalized] || CAPABILITY_LEVELS.SAFE;
}

/**
 * Resuelve la capacidad efectiva.
 * Se elimina el fail-closed ciego: herramientas desconocidas
 * resuelven a SAFE por defecto, permitiendo que MCPs y herramientas
 * de terceros operen sin bloqueos innecesarios.
 *
 * @param {string} tool
 * @returns {"SAFE"|"GUARDED"|"BLOCKED"}
 */
export function getEffectiveCapability(tool) {
  return getCapability(tool);
}

/**
 * ¿Es una herramienta mutante? (GUARDED o BLOCKED).
 *
 * @param {string} tool
 * @returns {boolean}
 */
export function isMutatingCapability(tool) {
  const eff = getEffectiveCapability(tool);
  return eff === CAPABILITY_LEVELS.GUARDED || eff === CAPABILITY_LEVELS.BLOCKED;
}