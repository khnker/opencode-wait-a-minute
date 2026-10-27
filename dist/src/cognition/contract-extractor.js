/**
 * Structured contract extraction.
 *
 * Turns a prompt into objective/deliverables/constraints/non-goals/acceptance
 * before any requirement is derived. Prose without a deliverable yields no
 * requirements instead of fabricated ones.
 */

const ACTION_VERB_RE =
  /^(implementa|implementar|crea|crear|agrega|agregar|arregla|arreglar|refactoriza|refactorizar|migra|migrar|configura|configurar|habilita|habilitar|elimina|eliminar|borra|borrar|quita|quitar|documenta|documentar|audita|auditar|analiza|analizar|revisa|revisar|eval[uú]a|evaluar|investiga|investigar|ve\s+que|mira\s+|build|create|implement|add|fix|refactor|migrate|configure|enable|delete|remove|analyze|review|document|audit|evaluate|investigate)\b/i;

const CONSTRAINT_RE =
  /\b(no\s+(?:toques|modifiques|cambies|uses)|sin\s+|solo\s+|solamente\s+|must|debe\s+|no\s+debe|without|only|excluye|limita)\b/i;

const NON_GOAL_RE =
  /\b(fuera\s+de\s+alcance|out\s+of\s+scope|no\s+incluye|no\s+es\s+parte|excluye)\b/i;

const ACCEPTANCE_RE =
  /\b(test|tests|prueba|pruebas|verifica|verificaci[oó]n|validaci[oó]n|criterio|aceptaci[oó]n|evidencia)\b/i;

function stripPunctuation(value) {
  return String(value || "").replace(/[.!¿?]+$/, "").trim();
}

function splitSentences(text) {
  return String(text || "")
    .split(/\.\s+|[;!?\n]+/)
    .map(stripPunctuation)
    .filter((s) => s.length > 4);
}

/**
 * @param {string} prompt
 * @returns {{ objective: string, deliverables: string[], constraints: string[], nonGoals: string[], acceptance: Array<{criterion:string, evidence:string}>, needsClarification: boolean }}
 */
export function extractContract(prompt) {
  const text = String(prompt ?? "").trim();
  const deliverables = [];
  const constraints = [];
  const nonGoals = [];
  const acceptance = [];

  for (const sentence of splitSentences(text)) {
    if (NON_GOAL_RE.test(sentence)) {
      nonGoals.push(sentence);
      continue;
    }
    if (CONSTRAINT_RE.test(sentence) && !ACTION_VERB_RE.test(sentence)) {
      constraints.push(sentence);
      continue;
    }
    if (ACTION_VERB_RE.test(sentence)) {
      deliverables.push(sentence);
      if (ACCEPTANCE_RE.test(sentence)) {
        acceptance.push({ criterion: sentence, evidence: "Verificación del requisito" });
      }
    }
  }

  const objective = deliverables[0] || "";
  return {
    objective,
    deliverables,
    constraints,
    nonGoals,
    acceptance,
    needsClarification: deliverables.length === 0,
  };
}

/**
 * Requirements come only from deliverables, preserving the original verb.
 */
export function contractToRequirements(contract) {
  return (contract?.deliverables || []).map((d) => {
    const clean = stripPunctuation(d);
    return clean ? clean[0].toUpperCase() + clean.slice(1) : clean;
  }).filter(Boolean);
}
