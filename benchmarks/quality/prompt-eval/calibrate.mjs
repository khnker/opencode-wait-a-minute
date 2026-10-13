/**
 * Judge calibration: Cohen's κ between deterministic oracle verdicts and a
 * frozen, human-annotated (PROVISIONAL single-annotator) gold set.
 *
 * This module quantifies how well the free-text oracles in `deterministic.mjs`
 * agree with ground-truth labels so the evaluator can be trusted (or flagged)
 * BEFORE any variant comparison. It is pure arithmetic + light I/O helpers:
 *
 *   - `computeKappa(oraclePass[], goldPass[])` : confusion counts, precision,
 *     recall, F1 and Cohen's κ with honest edge-case handling (never NaN).
 *   - `collectOracleVerdicts({ suites, outputs })` : recompute oracle verdicts
 *     over frozen raw outputs.
 *   - `calibrate({ suites, gold, oracleVerdicts })` : per-criterion, per-suite
 *     and overall statistics plus a `gate` verdict with explicit reasons.
 *   - `loadGold(dir)` : normalized label loader with schema validation that
 *     reports problems as `errors[]` instead of throwing.
 *   - `serializeCalibration(cal)` : deterministic, timestamp-free JSON.
 *
 * GATE RULES (design.md): FAIL if overall κ < 0.6, any per-criterion κ < 0.4,
 * any required criterion has zero calibratable pairs, or any false positive
 * (oracle=pass, gold=fail) lands on a negation guard (`excludes-any` /
 * `not-matches`). Reason strings are attached so CI output is actionable.
 */
import fs from "node:fs";
import path from "node:path";

import { evaluateScenario } from "./deterministic.mjs";

export const CALIBRATION_SCHEMA = "wam.prompt-eval.calibration/1";
export const GOLD_SCHEMA = "wam.prompt-eval.gold/1";
export const GOLD_VERSION = "v1-provisional";

/**
 * Calibration scope disclosure. Oracles are recalibrated on the same gold pairs
 * they are scored against, so the reported κ is an in-sample upper bound (by
 * construction), not a generalization estimate. Emitted on every calibration
 * artifact so consumers cannot mistake it for out-of-sample evidence.
 */
export const CALIBRATION_SCOPE = "in-sample";

/** Oracle kinds that assert the ABSENCE of a pattern (negation guards). */
export const NEGATION_ORACLE_KINDS = Object.freeze(["excludes-any", "not-matches"]);

export const GATE_THRESHOLDS = Object.freeze({
  overallKappa: 0.6,
  criterionKappa: 0.4,
});

const PASS = "pass";
const FAIL = "fail";

/**
 * Cohen's κ + agreement metrics for two boolean rater vectors.
 *
 * Positive class = "pass". `fp` is the dangerous cell for negation guards
 * (oracle says pass while gold says fail).
 *
 * @param {boolean[]} oraclePass
 * @param {boolean[]} goldPass
 * @returns {{kappa: number|null, po: number|null, pe: number|null,
 *   confusion: {tp:number,fp:number,tn:number,fn:number},
 *   precision: number|null, recall: number|null, f1: number|null,
 *   n: number, reason?: string}}
 */
export function computeKappa(oraclePass, goldPass) {
  if (!Array.isArray(oraclePass) || !Array.isArray(goldPass)) {
    throw new TypeError("computeKappa: oraclePass and goldPass must be arrays");
  }
  if (oraclePass.length !== goldPass.length) {
    throw new TypeError(
      `computeKappa: length mismatch (oracle=${oraclePass.length}, gold=${goldPass.length})`,
    );
  }

  const n = oraclePass.length;
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < n; i += 1) {
    const o = oraclePass[i] === true;
    const g = goldPass[i] === true;
    if (o && g) tp += 1;
    else if (o && !g) fp += 1;
    else if (!o && g) fn += 1;
    else tn += 1;
  }

  const confusion = { tp, fp, tn, fn };
  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 =
    precision != null && recall != null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;

  const base = { confusion, precision, recall, f1, n };

  if (n === 0) {
    return {
      kappa: null,
      po: null,
      pe: null,
      ...base,
      reason: "no pairs to compare (n=0)",
    };
  }

  const po = (tp + tn) / n;
  const oraclePassRate = (tp + fp) / n;
  const goldPassRate = (tp + fn) / n;
  const pe = oraclePassRate * goldPassRate + (1 - oraclePassRate) * (1 - goldPassRate);

  // Zero denominator: chance agreement saturates at 1 (no variance in at least
  // one rater). κ is undefined; report null with a reason rather than NaN.
  if (pe >= 1 - Number.EPSILON) {
    return {
      kappa: null,
      po,
      pe,
      ...base,
      reason: "chance agreement is 1 (degenerate: no variance across raters)",
    };
  }

  return { kappa: (po - pe) / (1 - pe), po, pe, ...base };
}

function kappaOf(pairs) {
  return computeKappa(
    pairs.map((p) => p.oraclePass),
    pairs.map((p) => p.goldPass),
  );
}

/**
 * Recompute oracle verdicts over raw outputs for every scenario×criterion.
 *
 * @param {{ suites: object[], outputs?: Record<string, Record<string, string>> }} args
 * @returns {Record<string, Record<string, Record<string, {passed:boolean, evaluable:boolean, oracleKind:string|null, required:boolean}>>>}
 */
export function collectOracleVerdicts({ suites = [], outputs = {} } = {}) {
  const result = {};
  for (const suite of suites) {
    result[suite.id] = {};
    for (const scenario of suite.scenarios || []) {
      const output = outputs?.[suite.id]?.[scenario.id];
      const evaluated = evaluateScenario(scenario, output);
      const byId = {};
      for (const criterion of scenario.criteria || []) {
        byId[criterion.id] = criterion;
      }
      result[suite.id][scenario.id] = {};
      for (const verdict of evaluated.criteria) {
        const criterion = byId[verdict.criterionId];
        result[suite.id][scenario.id][verdict.criterionId] = {
          passed: verdict.passed === true,
          evaluable: verdict.evaluable === true,
          oracleKind: criterion?.oracle?.kind ?? null,
          required: Boolean(criterion?.required),
        };
      }
    }
  }
  return result;
}

function normalizeLabels(gold) {
  if (!gold) return {};
  if (typeof gold === "object" && gold.labels && typeof gold.labels === "object") {
    return gold.labels;
  }
  return gold;
}

function isNegationGuard(kind) {
  return NEGATION_ORACLE_KINDS.includes(kind);
}

function fmtNum(value) {
  return value == null ? "null" : Number(value).toFixed(3);
}

function evaluateGate({ overall, criteria }) {
  const reasons = [];

  if (overall.kappa == null) {
    reasons.push(
      `overall κ unavailable (${overall.reason ?? "insufficient data"}); need κ ≥ ${GATE_THRESHOLDS.overallKappa}`,
    );
  } else if (overall.kappa < GATE_THRESHOLDS.overallKappa) {
    reasons.push(`overall κ ${fmtNum(overall.kappa)} < ${GATE_THRESHOLDS.overallKappa}`);
  }

  for (const c of criteria) {
    if (c.required && c.n === 0) {
      reasons.push(
        `required criterion ${c.criterionId} is uncalibrated (0 evaluable & labelled pairs)`,
      );
    }
    if (c.kappa != null && c.kappa < GATE_THRESHOLDS.criterionKappa) {
      reasons.push(`criterion ${c.criterionId} κ ${fmtNum(c.kappa)} < ${GATE_THRESHOLDS.criterionKappa}`);
    }
    if (c.negationGuard && c.confusion.fp > 0) {
      reasons.push(
        `criterion ${c.criterionId} negation guard false positive (oracle=pass, gold=fail) ×${c.confusion.fp}`,
      );
    }
  }

  return { status: reasons.length === 0 ? "pass" : "fail", reasons };
}

/**
 * Compute the full calibration record.
 *
 * @param {{ suites?: object[], gold?: object, oracleVerdicts?: object }} args
 * @returns {object} deterministic calibration record
 */
export function calibrate({ suites = [], gold, oracleVerdicts = {} } = {}) {
  const labels = normalizeLabels(gold);

  // Materialize every scenario×criterion slot, keeping suite/criteria order.
  const slots = [];
  for (const suite of suites) {
    for (const scenario of suite.scenarios || []) {
      for (const criterion of scenario.criteria || []) {
        const goldEntry = labels?.[suite.id]?.[scenario.id]?.[criterion.id];
        const verdict = oracleVerdicts?.[suite.id]?.[scenario.id]?.[criterion.id];
        const labelled = goldEntry?.label === PASS || goldEntry?.label === FAIL;
        const evaluable = verdict?.evaluable === true;
        slots.push({
          suiteId: suite.id,
          scenarioId: scenario.id,
          criterionId: criterion.id,
          oracleKind: verdict?.oracleKind ?? criterion.oracle?.kind ?? null,
          required: Boolean(verdict?.required ?? criterion.required),
          labelled,
          evaluable,
          goldPass: labelled ? goldEntry.label === PASS : undefined,
          oraclePass: evaluable ? verdict.passed === true : undefined,
        });
      }
    }
  }

  const usable = slots.filter((s) => s.labelled && s.evaluable);
  const overall = kappaOf(usable);

  const suiteStats = suites.map((suite) => {
    const suiteSlots = slots.filter((s) => s.suiteId === suite.id);
    const suiteUsable = usable.filter((s) => s.suiteId === suite.id);

    const criteria = [];
    const seen = new Set();
    for (const slot of suiteSlots) {
      if (seen.has(slot.criterionId)) continue;
      seen.add(slot.criterionId);
      const criterionUsable = usable.filter((s) => s.criterionId === slot.criterionId);
      const criterionLabelled = slots.filter(
        (s) => s.criterionId === slot.criterionId && s.labelled,
      );
      const stat = kappaOf(criterionUsable);
      criteria.push({
        criterionId: slot.criterionId,
        required: slot.required,
        oracleKind: slot.oracleKind,
        negationGuard: isNegationGuard(slot.oracleKind),
        labelled: criterionLabelled.length,
        ...stat,
      });
    }
    criteria.sort((a, b) =>
      a.criterionId < b.criterionId ? -1 : a.criterionId > b.criterionId ? 1 : 0,
    );

    return {
      suite: suite.id,
      version: suite.version ?? null,
      ...kappaOf(suiteUsable),
      criteria,
    };
  });

  const allCriteria = suiteStats.flatMap((s) => s.criteria);

  return {
    schema: CALIBRATION_SCHEMA,
    scope: CALIBRATION_SCOPE,
    overall,
    suites: suiteStats,
    criteria: allCriteria,
    gate: evaluateGate({ overall, criteria: allCriteria }),
  };
}

/**
 * Deterministic serialization: insertion-ordered keys, 2-space indent, no
 * timestamps. Repeated calls produce byte-identical output.
 *
 * @param {object} cal
 * @returns {string}
 */
export function serializeCalibration(cal) {
  return `${JSON.stringify(cal, null, 2)}\n`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Load a gold fixture directory. Never throws on content problems: structural
 * issues are collected in `errors` and the normalized structure is returned so
 * the caller can decide how to gate.
 *
 * @param {string} dir directory containing `meta.json` + optional `labels.json`
 * @returns {{dir: string|null, version: string|null, meta: object|null,
 *   labels: Record<string, Record<string, Record<string, {label:string, rationale:string}>>>,
 *   errors: string[]}}
 */
export function loadGold(dir) {
  const result = { dir: dir ?? null, version: null, meta: null, labels: {}, errors: [] };
  if (!dir) {
    result.errors.push("gold directory not provided");
    return result;
  }

  const abs = path.resolve(dir);
  result.dir = abs;

  const metaPath = path.join(abs, "meta.json");
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      result.meta = meta;
      result.version = typeof meta?.version === "string" ? meta.version : null;
      const provenance = meta?.provenance;
      const provenanceOk =
        (typeof provenance === "string" && provenance.trim().length > 0) ||
        (isPlainObject(provenance) &&
          (typeof provenance.annotator === "string" ||
            provenance.singleAnnotator === true ||
            provenance["single-annotator"] === true));
      if (!provenanceOk) {
        result.errors.push(
          "meta.json: provenance must be a non-empty string or an object with annotator/singleAnnotator",
        );
      }
    } catch (err) {
      result.errors.push(`meta.json: invalid JSON (${err.message})`);
    }
  } else {
    result.errors.push(`meta.json missing at ${metaPath}`);
  }

  const labelsPath = path.join(abs, "labels.json");
  if (!fs.existsSync(labelsPath)) {
    result.errors.push(`labels.json missing at ${labelsPath}`);
    return result;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(labelsPath, "utf8"));
  } catch (err) {
    result.errors.push(`labels.json: invalid JSON (${err.message})`);
    return result;
  }

  if (!isPlainObject(raw)) {
    result.errors.push("labels.json: top level must be an object keyed by suite id");
    return result;
  }

  for (const [suiteId, scenarios] of Object.entries(raw)) {
    if (!isPlainObject(scenarios)) {
      result.errors.push(`labels.${suiteId}: must be an object keyed by scenario id`);
      continue;
    }
    result.labels[suiteId] = {};
    for (const [scenarioId, criteria] of Object.entries(scenarios)) {
      if (!isPlainObject(criteria)) {
        result.errors.push(`labels.${suiteId}.${scenarioId}: must be an object keyed by criterion id`);
        continue;
      }
      result.labels[suiteId][scenarioId] = {};
      for (const [criterionId, entry] of Object.entries(criteria)) {
        const where = `labels.${suiteId}.${scenarioId}.${criterionId}`;
        if (!isPlainObject(entry)) {
          result.errors.push(`${where}: must be an object { label, rationale }`);
          continue;
        }
        if (entry.label !== PASS && entry.label !== FAIL) {
          result.errors.push(`${where}.label: must be "pass" or "fail"`);
          continue;
        }
        if (typeof entry.rationale !== "string" || entry.rationale.trim().length === 0) {
          result.errors.push(`${where}.rationale: must be a non-empty string`);
          continue;
        }
        result.labels[suiteId][scenarioId][criterionId] = {
          label: entry.label,
          rationale: entry.rationale,
        };
      }
    }
  }

  return result;
}
