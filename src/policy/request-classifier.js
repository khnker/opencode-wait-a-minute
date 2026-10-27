/**
 * Pre-flight request classification logic.
 */

const META_ONLY_RE =
  /^(ok|okay|vale|perfecto|gracias|thanks|thx|sigue|contin[uú]a|contin[uú]e|adelante|dale|hazlo)$/i;

const META_PHRASE_RE =
  /^(no\s+te\s+(detengas?|detenga|pares?|para)|responde\s+(solo|solamente)|(ahora\s+)?(eres|s[eé]|seas)\s+(responsable|encargad[oa])|(que\s+)?(est[eé]|todo)\s+(bien|ok|listo|correcto)|arregla\s+todo|fix\s+everything)\b/i;

const QUESTION_LIKE_RE =
  /\b(no\s+deber[ií]a|por\s+qu[eé]|no\s+funciona|est[aá]\s+mal|se\s+comporta\s+mal)\b/i;

function isMetaOnlyClause(clause) {
  const trimmed = clause.trim();
  if (!trimmed) return true;
  return (
    META_ONLY_RE.test(trimmed) ||
    META_PHRASE_RE.test(trimmed) ||
    QUESTION_LIKE_RE.test(trimmed) ||
    /^todo$/i.test(trimmed)
  );
}

export function isMetaOnlyPrompt(prompt) {
  const normalized = String(prompt ?? "").replace(/https?:\/\/\S+/gi, " URL ");
  const clauses = normalized
    .split(/[;,.!?]|\by\b|\band\b/i)
    .map((c) => c.trim())
    .filter(Boolean);
  return clauses.length > 0 && clauses.every(isMetaOnlyClause);
}

export function classifyRequest(prompt) {
  const lower = String(prompt ?? "").toLowerCase();

  if (isMetaOnlyPrompt(prompt)) {
    return { type: "trivial", ambiguity: "low", confidence: 95 };
  }

  // Trivial patterns - bypass wait-a-minute
  const trivialPatterns = [
    /^\s*rename\s+/i,
    /^\s*renombra\s+/i,
    /^\s*cambia\s+\w+/i,
    /^\s*change\s+\w+/i,
    /^\s*what(is|are)\s+/i,
    /^\s*qué\s+es\s+/i,
    /^\s*que\s+es\s+/i,
    /^\s*explain\s+/i,
    /^\s*explica\s+/i,
    /^\s*how\s+to\s+/i,
    /^\s*cómo\s+/i,
    /^\s*como\s+hago\s+/i,
    /^\s*list\s+/i,
    /^\s*lista\s+/i,
    /^\s*listar\s+/i,
    /^\s*show\s+/i,
    /^\s*muestra\s+/i,
    /^\s*get\s+\w+/i,
  ];

  for (const pattern of trivialPatterns) {
    if (pattern.test(prompt)) {
      return { type: "trivial", ambiguity: "low", confidence: 95 };
    }
  }

  // Architecture/security/high-risk patterns -> STRICT
  const strictPatterns = [
    /(migra|migrate)/i,
    /(seguridad|security)/i,
    /(arquitectura|architecture)/i,
    /(provee(?:r|ndase)|provide)/i,
    /(alto impacto|high impact)/i,
    /(producción|production)/i,
    /(destructivo|destructive)/i,
  ];

  let strictMatch = null;
  for (const pattern of strictPatterns) {
    if (pattern.test(prompt)) {
      strictMatch = pattern;
      break;
    }
  }

  if (strictMatch) {
    return {
      type: "architectural",
      ambiguity: "medium",
      confidence: 60,
      mode: "STRICT",
    };
  }

  // Research/exploration patterns
  const researchPatterns = [
    /(buscar|research)/i,
    /(comparar|compare)/i,
    /(opciones|options)/i,
    /(alternativas|alternatives)/i,
  ];

  for (const pattern of researchPatterns) {
    if (pattern.test(prompt)) {
      return { type: "research", ambiguity: "medium", confidence: 70 };
    }
  }

  // Default: normal ambiguity
  return { type: "normal", ambiguity: "medium", confidence: 50 };
}
