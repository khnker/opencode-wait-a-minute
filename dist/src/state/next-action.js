/**
 * Pure next-action derivation, shared by orchestration and context assembly.
 * Kept dependency-free to avoid an import cycle (task-state <-> orchestration).
 */

function truncate(text, max = 80) {
  const str = String(text ?? "");
  return str.length > max ? `${str.slice(0, max - 3)}...` : str;
}

export function nextActionFrom(state) {
  const pending = (state?.requirements || []).find(
    (r) => !["done", "verified"].includes(r.status)
  );
  if (pending) {
    const title = truncate(pending.title);
    const label = /^[A-ZÁÉÍÓÚÑ]/.test(title) ? title : `Implementar ${title}`;
    return `${label} (${pending.id} ${pending.status})`;
  }
  const unverified = (state?.requirements || []).find(
    (r) =>
      r.status === "done" ||
      (r.status === "verified" && !(r.evidence || []).length)
  );
  if (unverified) {
    return `Verificar ${truncate(unverified.title)} — /wam progress ${unverified.id} verified <evidencia>`;
  }
  if (state?.requirements?.length) {
    const allVerified = (state.requirements || []).every(
      (r) => r.status === "verified" && (r.evidence || []).length > 0
    );
    return allVerified
      ? "Tarea completa — contrato verificado"
      : "Verificar requisitos completos antes de DONE";
  }
  return "Continuar tarea";
}
