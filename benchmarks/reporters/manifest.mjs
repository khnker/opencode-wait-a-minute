import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

const DEFAULT_LIMITATIONS = [
  "dry-run results are deterministic simulations, not model executions",
  "real provider runs require API credentials and are not reproduced by CI",
  "statistical significance assumes independent paired trials"
];

export function buildEvidenceManifest({
  report,
  suite,
  reportPath,
  repoCommit,
  generatedAt,
  limitations
} = {}) {
  if (!report || typeof report !== "object") {
    throw new Error("buildEvidenceManifest: report is required");
  }

  const reportEvidence = report.evidence;
  const evidenceCategory =
    (reportEvidence && typeof reportEvidence === "object" && reportEvidence.category) ||
    (typeof reportEvidence === "string" ? reportEvidence : "unknown");

  const artifacts = [];
  if (reportPath) {
    artifacts.push({
      path: path.basename(reportPath),
      bytes: fs.statSync(reportPath).size,
      sha256: sha256File(reportPath)
    });
  }

  const pairsCount = report.pairs
    ? Array.isArray(report.pairs)
      ? report.pairs.length
      : Object.keys(report.pairs).length
    : 0;

  const ablations = (report.ablation ?? []).map((a) => ({
    name: a.name,
    runs: a.runs,
    fastPathCount: a.fastPathCount,
    netInputSavings: a.netInputSavings
  }));

  return {
    schema: "rc1-evidence-manifest@1",
    generatedAt: generatedAt ?? new Date().toISOString(),
    repoCommit: repoCommit ?? "unknown",
    mode: report.mode,
    provider: report.provider ?? suite?.provider ?? null,
    model: report.model ?? null,
    evidenceCategory,
    counts: {
      runs: report.runs?.length ?? 0,
      trials: report.totals?.trials ?? 0,
      pairs: pairsCount
    },
    ablations,
    statistics: report.statistics ?? null,
    claims: report.claims ?? null,
    artifacts,
    limitations: limitations ?? DEFAULT_LIMITATIONS
  };
}