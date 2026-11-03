const IMPLEMENT_RE = /\b(implementa|implementar|agrega|agregar|añade|anade|crea|crear|corrige|corregir|arregla|arreglar|refactoriza|refactorizar|modifica|modificar|cambia|cambiar|actualiza|actualizar|migra|migrar|escribe|escribir|construye|construir|desarrolla|desarrollar|fix|implement|add|create|update|change|refactor|migrate|build)\b/i;
const ANALYSIS_DIRECTIVE_RE = /\b(analiza|analizar|análisis|analisis|investiga|investigar|diagnostica|diagnosticar|evalúa|evaluar|revisa|revisar|explica|explicar|entiende|entender)\b/i;
const ANALYSIS_SYMPTOM_RE = /\b(qué mejoras|que mejoras|cómo mejorar|como mejorar|por qué|por que|no funciona|comportamiento|arquitectura|diseño|diseno)\b/i;
const INLINE_RE = /^\s*(renombra|rename|mueve|move|borra|delete|elimina|remove|ajusta|adjust|formatea|format|comenta|comment)\b/i;

export function classifyExecutionIntent(prompt, { isTrivial } = {}) {
  const text = String(prompt || "").trim();
  if (!text) return "IMPLEMENT";

  const trivial = typeof isTrivial === "function"
    ? isTrivial(text)
    : isTrivial === true || INLINE_RE.test(text);
  if (trivial) return "INLINE";

  const analysisAt = text.search(ANALYSIS_DIRECTIVE_RE);
  const implementAt = text.search(IMPLEMENT_RE);
  if (analysisAt !== -1 && (implementAt === -1 || analysisAt < implementAt)) {
    return "ANALYZE";
  }
  if (implementAt !== -1) return "IMPLEMENT";
  if (ANALYSIS_SYMPTOM_RE.test(text)) return "ANALYZE";
  return "IMPLEMENT";
}
