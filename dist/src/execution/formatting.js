/**
 * Formatting — funciones puras de formateo y presentación.
 *
 * Contiene:
 *   - truncate: utilidad de truncamiento de texto (compartida)
 *   - getStatusReport: formatea reporte de estado (re-exportado)
 *
 * Todas son PURAS: toman datos como entrada, retornan strings/arrays.
 * Sin side effects (no persisten, no leen, no escriben).
 */

import { getStatusReport } from "./execution-state.js";

export { getStatusReport } from "./execution-state.js";

// -- Shared utility --------------------------------------------------------

/**
 * Trunca texto a máximo `max` caracteres con "..." al final.
 */
export function truncate(text, max = 80) {
  if (!text || text.length <= max) return text || "";
  return text.slice(0, max - 3) + "...";
}
