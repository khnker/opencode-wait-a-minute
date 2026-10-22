import fs from "node:fs";
import path from "node:path";

const VALID_STATUSES = new Set(["proposed", "accepted", "rejected", "superseded"]);
const VALID_SOURCES = new Set(["user-decided", "team-consensus", "architect-driven", "data-driven", "N0_POLICY", "N1_PROJECT", "N2_TASK", "OBSERVED"]);
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

function readDecisionsBody(root) {
  const base = root || process.cwd();
  const candidates = [
    path.join(base, ".wam", "context", "decisions.md"),
    path.join(base, "context", "decisions.md"),
    path.join(base, "decisions.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, "utf8");
        const parts = content.split(/^---\s*$/m);
        if (parts.length >= 3) {
          return parts.slice(2).join("---");
        }
        return content;
      } catch {
        // ignore
      }
    }
  }
  return "";
}

export function parseDecisionEntries(body) {
  if (!body || typeof body !== "string") return [];
  const list = [];
  const sections = body.split(/^##\s+/gm).filter(Boolean);
  for (const s of sections) {
    const lines = s.trim().split("\n");
    const idLine = lines[0].trim();
    const idMatch = idLine.match(/^(.+?)(?:\s*-\s*(.+))?$/);
    const id = idMatch ? idMatch[1].trim() : idLine;
    if (!id || id.startsWith("#") || /^(decisions|decision log)$/i.test(id)) continue;

    const entry = {
      id,
      date: undefined,
      status: "proposed",
      source: "user-decided",
      confidence: "medium",
      decision: "",
      reason: "",
      alternatives: [],
      impact: "",
      related: "",
      raw: s,
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const m = line.match(/^-\s+\*\*([a-zA-Z0-9_-]+)\*\*:\s*(.*)$/) || line.match(/^-\s+([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (m) {
        const key = m[1].toLowerCase();
        const val = m[2].trim();
        if (key === "date") entry.date = val;
        else if (key === "status") entry.status = val;
        else if (key === "source") entry.source = val;
        else if (key === "confidence") entry.confidence = val;
        else if (key === "decision") entry.decision = val;
        else if (key === "reason") entry.reason = val;
        else if (key === "alternatives") entry.alternatives = val;
        else if (key === "impact") entry.impact = val;
        else if (key === "related") entry.related = val;
      }
    }
    if (!entry.decision && lines.length > 1) {
      entry.decision = lines.slice(1).join(" ").trim();
    }
    list.push(entry);
  }
  return list;
}

export function validateDecisionEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== "object") {
    return { valid: false, errors: ["Entry must be an object"] };
  }
  const id = entry.id || entry.decisionPoint || entry.statement;
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    errors.push("Decision ID or statement is required");
  }
  const status = entry.status;
  if (status && !VALID_STATUSES.has(status)) {
    errors.push(`Invalid status: ${status}. Must be one of ${[...VALID_STATUSES].join(", ")}`);
  }
  const source = entry.source;
  if (source && !VALID_SOURCES.has(source)) {
    errors.push(`Invalid source: ${source}`);
  }
  const confidence = entry.confidence;
  if (confidence && !VALID_CONFIDENCE.has(confidence) && typeof confidence !== "number") {
    errors.push(`Invalid confidence: ${confidence}`);
  }
  const decision = entry.decision || entry.rationale || entry.statement;
  if (!decision || typeof decision !== "string" || decision.trim().length === 0) {
    errors.push("Decision statement/rationale is required");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateDecisionsMarkdown(body) {
  const entries = parseDecisionEntries(body);
  const errors = [];
  for (const entry of entries) {
    const res = validateDecisionEntry(entry);
    if (!res.valid) {
      errors.push(`Decision ${entry.id || "unknown"}: ${res.errors.join("; ")}`);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    entries,
  };
}

export function queryDecisions(criteria = {}, root) {
  const body = readDecisionsBody(root);
  const entries = parseDecisionEntries(body);
  return entries.filter(e => {
    if (criteria.status && e.status !== criteria.status) return false;
    if (criteria.source && e.source !== criteria.source) return false;
    if (criteria.confidence && e.confidence !== criteria.confidence) return false;
    if (criteria.id && e.id !== criteria.id) return false;
    if (criteria.startDate && e.date && e.date < criteria.startDate) return false;
    if (criteria.endDate && e.date && e.date > criteria.endDate) return false;
    if (criteria.search) {
      const q = criteria.search.toLowerCase();
      const matchText = `${e.id} ${e.decision} ${e.reason} ${e.impact}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });
}

export function exportDecisions(format = "json", root) {
  const entries = queryDecisions({}, root);
  if (format === "json") {
    return JSON.stringify(entries, null, 2);
  }
  if (format === "csv") {
    const headers = ["id", "date", "status", "source", "confidence", "decision", "reason"];
    const rows = [headers.join(",")];
    for (const e of entries) {
      const row = headers.map(h => {
        const val = String(e[h] || "").replace(/"/g, '""');
        return `"${val}"`;
      });
      rows.push(row.join(","));
    }
    return rows.join("\n");
  }
  if (format === "markdown") {
    const lines = ["# Decision Log", ""];
    for (const e of entries) {
      lines.push(`## ${e.id}`);
      if (e.date) lines.push(`- date: ${e.date}`);
      lines.push(`- status: ${e.status || "accepted"}`);
      lines.push(`- source: ${e.source || "user-decided"}`);
      lines.push(`- confidence: ${e.confidence || "medium"}`);
      lines.push(`- decision: ${e.decision || ""}`);
      if (e.reason) lines.push(`- reason: ${e.reason}`);
      if (e.alternatives) lines.push(`- alternatives: ${e.alternatives}`);
      if (e.impact) lines.push(`- impact: ${e.impact}`);
      lines.push("");
    }
    return lines.join("\n");
  }
  throw new Error(`Unsupported export format: ${format}`);
}

const ALLOWED_TRANSITIONS = {
  proposed: new Set(["accepted", "rejected"]),
  accepted: new Set(["superseded", "rejected"]),
  rejected: new Set(["proposed"]),
  superseded: new Set([]),
};

export function transitionDecisionStatus(id, newStatus, root) {
  if (!VALID_STATUSES.has(newStatus)) {
    return { ok: false, reason: `Invalid target status: ${newStatus}` };
  }
  const body = readDecisionsBody(root);
  if (!body) {
    return { ok: false, reason: "No decisions file found" };
  }
  const entries = parseDecisionEntries(body);
  const target = entries.find(e => e.id === id);
  if (!target) {
    return { ok: false, reason: `Decision not found: ${id}` };
  }
  const currentStatus = target.status || "proposed";
  if (currentStatus === newStatus) {
    return { ok: true, decision: target };
  }
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || new Set();
  if (!allowed.has(newStatus)) {
    return { ok: false, reason: `Invalid transition from ${currentStatus} to ${newStatus}` };
  }
  target.status = newStatus;
  return { ok: true, decision: target };
}

export function detectDuplicateDecision(entry, root) {
  const entries = queryDecisions({}, root);
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const targetDecision = norm(entry.decision || entry.statement || entry.decisionPoint);
  const targetId = entry.id;

  for (const e of entries) {
    if (targetId && e.id === targetId) {
      return { duplicate: true, existing: e, reason: "Same ID" };
    }
    if (targetDecision && norm(e.decision) === targetDecision) {
      return { duplicate: true, existing: e, reason: "Same decision statement" };
    }
  }
  return { duplicate: false };
}

export function checkDecisionImpactConsistency(root) {
  const entries = queryDecisions({}, root);
  const warnings = [];
  const errors = [];
  for (const e of entries) {
    if (e.status === "accepted" && (!e.reason || e.reason.trim().length === 0)) {
      warnings.push(`Accepted decision ${e.id} lacks a documented reason.`);
    }
    if (e.status === "accepted" && e.confidence === "low") {
      warnings.push(`Accepted decision ${e.id} has low confidence.`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
