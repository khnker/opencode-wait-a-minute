/**
 * Evidence Freshness / Closure
 *
 * Detects environment and artifact drift, invalidates affected evidence,
 * recomputes requirement satisfaction and returns a structured delta report.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const FRESHNESS_CONFIG = {
  MAX_AGE_HOURS: 72,
  WEIGHTS: {
    NEWS_COUNT: 0.5,
    HN_SCORE: 0.25,
    AGE_DECAY: 0.25,
  },
  ALERTS: {
    STALE: "stale",
    CRITICAL: "critical",
  },
};

export function calculateFreshnessScore(metrics) {
  const { newsCount = 0, hnScore = 0, maxAgeHours = 0 } = metrics;
  const normalizedNews = Math.min(newsCount / 10, 1) * 100;
  const normalizedHn = Math.min(hnScore / 100, 1) * 100;
  const ageDecay = Math.exp(-maxAgeHours / 72);
  const score =
    normalizedNews * FRESHNESS_CONFIG.WEIGHTS.NEWS_COUNT +
    normalizedHn * FRESHNESS_CONFIG.WEIGHTS.HN_SCORE +
    ageDecay * FRESHNESS_CONFIG.WEIGHTS.AGE_DECAY;
  return Math.round(score * 100) / 100;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function taskDir(taskId, root) {
  return path.join(root || process.cwd(), ".wam", "tasks", taskId);
}

function lineageDir(taskId, root) {
  return path.join(taskDir(taskId, root), "lineage");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function readTaskState(taskId, root) {
  const dir = taskDir(taskId, root);
  for (const name of ["task.json", "state.yaml"]) {
    const file = path.join(dir, name);
    const value = readJson(file);
    if (value) return { state: value, file };
  }
  return { state: null, file: null };
}

function loadEvidence(taskId, root) {
  const dir = lineageDir(taskId, root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: path.join(dir, f), evidence: readJson(path.join(dir, f)) }))
    .filter((e) => e.evidence);
}

function saveEvidence(entry) {
  writeJson(entry.file, entry.evidence);
}

export function captureEnvironment(root = process.cwd()) {
  let repositoryRevision = "";
  try {
    const head = fs.readFileSync(path.join(root, ".git", "HEAD"), "utf8").trim();
    const ref = head.replace(/^ref:\s*/, "");
    const refPath = path.join(root, ".git", ref);
    repositoryRevision = fs.existsSync(refPath)
      ? fs.readFileSync(refPath, "utf8").trim().slice(0, 12)
      : head.slice(0, 12);
  } catch {}
  return {
    os: `${process.platform}-${process.arch}`,
    nodeVersion: process.version,
    executable: process.execPath,
    repositoryRevision,
    capturedAt: Date.now(),
  };
}

export function fingerprintArtifacts(root, files = []) {
  const out = {};
  for (const rel of files) {
    const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
    try {
      const content = fs.readFileSync(abs);
      out[rel] = {
        hash: sha256(content),
        mtime: fs.statSync(abs).mtimeMs,
      };
    } catch {
      out[rel] = { hash: null, mtime: 0 };
    }
  }
  return out;
}

function evidenceStatusSatisfies(evidence) {
  return evidence?.status === "valid" || evidence?.status === "verified";
}

function satisfiedRequirements(state, evidenceList) {
  const result = [];
  for (const req of state?.requirements || []) {
    const id = req.id || req.requirementId;
    if (evidenceList.some((e) => e.requirementId === id && evidenceStatusSatisfies(e))) {
      result.push(id);
    }
  }
  return result;
}

export function refreshEvidenceValidity(taskId, root = process.cwd()) {
  root = root || process.cwd();
  const { state, file: stateFile } = readTaskState(taskId, root);
  const entries = loadEvidence(taskId, root);
  const evidenceList = entries.map((e) => e.evidence);

  const previousEnvironment = state?.currentEnvironment || null;
  const currentEnvironment = captureEnvironment(root);

  const relevantFiles = new Set(state?.relevantFiles || []);
  for (const evidence of evidenceList) {
    for (const p of Object.keys(evidence.artifactHashes || {})) relevantFiles.add(p);
  }
  const currentFps = fingerprintArtifacts(root, [...relevantFiles]);
  const previousFps = state?.artifacts || {};

  const evidenceHashes = {};
  for (const evidence of evidenceList) {
    for (const [p, hash] of Object.entries(evidence.artifactHashes || {})) {
      evidenceHashes[p] = hash;
    }
  }

  const artifactChanges = [];
  for (const [p, fp] of Object.entries(currentFps)) {
    const prev = previousFps[p];
    const evidenceHash = evidenceHashes[p];
    if (!prev) {
      if (evidenceHash === fp.hash) continue;
      artifactChanges.push({
        path: p,
        status: evidenceHash ? "modified" : "added",
        previousHash: evidenceHash || null,
        currentHash: fp.hash,
      });
    } else if (prev.hash !== fp.hash) {
      artifactChanges.push({ path: p, status: "modified", previousHash: prev.hash, currentHash: fp.hash });
    }
  }

  const satisfiedBefore = satisfiedRequirements(state, evidenceList);
  const invalidatedEvidence = [];
  const reasons = state ? [] : ["task state not found"];

  for (const entry of entries) {
    const evidence = entry.evidence;
    if (!evidenceStatusSatisfies(evidence)) continue;
    let invalidated = false;
    for (const [p, recordedHash] of Object.entries(evidence.artifactHashes || {})) {
      const current = currentFps[p]?.hash;
      if (current && recordedHash && current !== recordedHash) {
        invalidated = true;
        reasons.push(`artifact drift: ${p}`);
        break;
      }
    }
    if (invalidated) {
      evidence.status = "invalidated";
      evidence.invalidatedAt = new Date().toISOString();
      evidence.invalidatedReason = "artifact drift";
      saveEvidence(entry);
      invalidatedEvidence.push(evidence.id);
    }
  }

  const satisfiedAfter = satisfiedRequirements(state, evidenceList);
  const unsatisfiedDelta = {
    lost: satisfiedBefore.filter((id) => !satisfiedAfter.includes(id)),
    gained: satisfiedAfter.filter((id) => !satisfiedBefore.includes(id)),
  };

  const report = {
    taskId,
    root,
    recomputedAt: Date.now(),
    drifted: invalidatedEvidence.length > 0 || artifactChanges.some((c) => c.status === "modified"),
    reasons,
    artifactChanges,
    invalidatedEvidence,
    previousEnvironment,
    currentEnvironment,
    satisfiedBefore,
    satisfiedAfter,
    unsatisfiedDelta,
  };

  if (state) {
    state.artifacts = currentFps;
    state.currentEnvironment = currentEnvironment;
    for (const req of state.requirements || []) {
      const id = req.id || req.requirementId;
      if (satisfiedAfter.includes(id) && req.status !== "done") req.status = "verified";
      if (!satisfiedAfter.includes(id) && req.status === "verified") req.status = "pending";
    }
    writeJson(stateFile || path.join(taskDir(taskId, root), "task.json"), state);
  }
  writeJson(path.join(taskDir(taskId, root), "freshness.json"), report);
  return report;
}

export function isDoneAllowed(taskId, root = process.cwd()) {
  const report = refreshEvidenceValidity(taskId, root);
  const lost = report.unsatisfiedDelta?.lost || [];
  if (report.invalidatedEvidence.length > 0 || lost.length > 0) {
    return {
      allowed: false,
      reason: `evidence drift: ${[...report.invalidatedEvidence, ...lost].join(", ")}`,
      report,
    };
  }
  const unsatisfied = Object.entries(report.satisfiedAfter || {})
    .filter(([, ok]) => !ok)
    .map(([id]) => id);
  if (unsatisfied.length > 0) {
    return { allowed: false, reason: `unverified requirements: ${unsatisfied.join(", ")}`, report };
  }
  return { allowed: true, reason: "all requirements verified", report };
}

export async function detectDrift(taskId, root = process.cwd()) {
  const report = refreshEvidenceValidity(taskId, root);
  return {
    drifted: report.drifted,
    reasons: report.reasons,
    previousEnvironment: report.previousEnvironment,
    currentEnvironment: report.currentEnvironment,
    artifactChanges: report.artifactChanges,
  };
}
