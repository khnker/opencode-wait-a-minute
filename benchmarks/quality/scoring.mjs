/**
 * Pure, deterministic helpers for the QUALITY A/B benchmark.
 *
 * Scoring rules:
 *   - normalize(s)              trim / lowercase / collapse whitespace.
 *   - factCoverage             substring containment over normalized strings.
 *   - parseJudgeJson           fence-aware JSON extraction from judge prose.
 *   - extractFinalAnswer       isolate the committed answer from CoT prose.
 *   - aggregate                trivial descriptive stats over numeric scores.
 *   - pairedQualityDelta       numeric compare vs EPS, count wins/losses/ties.
 *
 * All helpers are total functions: no throws, no I/O, no network.
 */

const EPS = 1e-9;

export function normalize(s) {
  if (typeof s !== "string") return "";
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Instruction appended (identically) to BOTH arms of the quality A/B run so the
 * model commits to a machine-extractable final answer. Without this, a
 * chain-of-thought response is judged on its reasoning text, which penalizes
 * verbosity rather than measuring answer correctness.
 */
export const ANSWER_INSTRUCTION =
  "End your response with a single line in the exact form `FINAL ANSWER: <answer>` " +
  "containing only the final answer (no reasoning after it).";

/**
 * Extract the final answer from a possibly chain-of-thought response.
 *
 * Takes the content after the LAST `FINAL ANSWER:` marker (case-insensitive),
 * which is where the model commits to its answer. When no marker is present the
 * whole trimmed text is returned (total function, never throws).
 *
 * @param {string} text
 * @returns {string}
 */
export function extractFinalAnswer(text) {
  if (typeof text !== "string") return "";
  const re = /final\s+answer\s*:/gi;
  let end = -1;
  let m;
  while ((m = re.exec(text)) !== null) {
    end = m.index + m[0].length;
  }
  if (end === -1) return text.trim();
  return text.slice(end).trim();
}

function factToVariants(fact) {
  if (fact == null) return [];
  if (typeof fact === "string") return [fact];
  if (typeof fact === "object" && Array.isArray(fact.any)) {
    return fact.any.filter((v) => typeof v === "string");
  }
  return [];
}

function totalCount(facts) {
  if (!Array.isArray(facts)) return 0;
  let total = 0;
  for (const fact of facts) {
    if (typeof fact === "string") {
      total += 1;
    } else if (fact && typeof fact === "object" && Array.isArray(fact.any)) {
      // `{any}` is ONE logical fact, regardless of how many variants it has.
      total += 1;
    }
  }
  return total;
}

/**
 * Count how many required facts appear in `response`.
 *
 * @param {string} response   text the model produced.
 * @param {Array<string|{any:string[]}>} requiredFacts
 * @returns {{score:number, matched:Array<string>, missing:Array<string>, total:number}}
 */
export function factCoverage(response, requiredFacts) {
  const total = totalCount(requiredFacts);
  if (total === 0) {
    return { score: 1, matched: [], missing: [], total: 0 };
  }
  const normResp = normalize(response);
  const matched = [];
  const missing = [];
  if (!Array.isArray(requiredFacts)) {
    return { score: 0, matched: [], missing: [], total };
  }
  for (const fact of requiredFacts) {
    const variants = factToVariants(fact);
    if (variants.length === 0) {
      missing.push(String(fact));
      continue;
    }
    // A fact is considered matched if ANY of its variants appears.
    let anyMatched = false;
    for (const variant of variants) {
      const normVar = normalize(variant);
      if (normVar && normResp.includes(normVar)) {
        anyMatched = true;
        break;
      }
    }
    if (anyMatched) {
      matched.push(typeof fact === "string" ? fact : `any:${fact.any.join("|")}`);
    } else {
      missing.push(typeof fact === "string" ? fact : `any:${fact.any.join("|")}`);
    }
  }
  return { score: total > 0 ? matched.length / total : 1, matched, missing, total };
}

/**
 * Extract the first balanced JSON object from `text`. Strips ```json fences
 * and surrounding prose. Returns `null` if no balanced object can be located
 * or JSON.parse fails.
 */
export function extractFirstJsonObject(text) {
  if (typeof text !== "string") return null;
  // Strip ```json / ``` fences (commonly produced by judge LLMs).
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  // Look for the first '{' that yields a balanced JSON object.
  for (let i = 0; i < cleaned.length; i += 1) {
    if (cleaned[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < cleaned.length; j += 1) {
      const ch = cleaned[j];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = cleaned.slice(i, j + 1);
          try {
            return JSON.parse(candidate);
          } catch (_) {
            // Bail out of this candidate; keep scanning for the next '{'.
            break;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Parse the judge's prose response into a normalized record.
 *
 * @param {string} text
 * @returns {{score:number|null, pass:boolean, reason:string}|null}
 */
export function parseJudgeJson(text) {
  const obj = extractFirstJsonObject(text);
  if (!obj || typeof obj !== "object") return null;
  const rawScore = Number(obj.score);
  const score = Number.isFinite(rawScore) ? Math.min(100, Math.max(0, rawScore)) : null;
  const passVal = obj.pass;
  const pass =
    typeof passVal === "boolean"
      ? passVal
      : typeof passVal === "string"
      ? ["true", "1", "yes", "pass"].includes(passVal.toLowerCase())
      : score != null && score >= 50;
  const reason = typeof obj.reason === "string" ? obj.reason : "";
  return { score, pass, reason };
}

/**
 * Aggregate numeric scores into descriptive statistics.
 *
 * @param {Iterable<number>} scores
 * @returns {{n:number, mean:number, median:number, min:number, max:number}}
 */
export function aggregate(scores) {
  const xs = [];
  for (const v of scores ?? []) {
    if (typeof v === "number" && Number.isFinite(v)) xs.push(v);
  }
  if (xs.length === 0) {
    return { n: 0, mean: 0, median: 0, min: 0, max: 0 };
  }
  let sum = 0;
  let min = xs[0];
  let max = xs[0];
  for (const v of xs) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const sorted = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  return {
    n: xs.length,
    mean: sum / xs.length,
    median,
    min,
    max
  };
}

/**
 * Pairwise comparison of two aligned numeric series.
 *
 * @param {Array<number>} baseScores
 * @param {Array<number>} wamScores
 * @returns {{n:number, meanDelta:number, wins:number, losses:number, ties:number}}
 */
export function pairedQualityDelta(baseScores, wamScores) {
  const a = Array.isArray(baseScores) ? baseScores : [];
  const b = Array.isArray(wamScores) ? wamScores : [];
  const n = Math.min(a.length, b.length);
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let deltaSum = 0;
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a[i];
    const y = b[i];
    if (typeof x !== "number" || !Number.isFinite(x)) continue;
    if (typeof y !== "number" || !Number.isFinite(y)) continue;
    const d = y - x;
    deltaSum += d;
    count += 1;
    if (Math.abs(d) <= EPS) ties += 1;
    else if (d > 0) wins += 1;
    else losses += 1;
  }
  return {
    n: count,
    meanDelta: count > 0 ? deltaSum / count : 0,
    wins,
    losses,
    ties
  };
}
