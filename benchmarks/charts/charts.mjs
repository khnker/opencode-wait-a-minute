function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bar(x, y, w, h, fill) {
  return `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" fill="${fill}"/>`;
}

function text(x, y, body, size = 11, anchor = "middle") {
  return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" font-family="sans-serif">${esc(body)}</text>`;
}

function groupedBarChart(title, scenarios, baselineKeys, wamKeys, width = 640, height = 320) {
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const max = Math.max(1, ...baselineKeys, ...wamKeys);
  const slot = plotW / scenarios.length;
  const barW = Math.min(24, slot / 3);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  svg += text(width / 2, 22, title, 14);
  svg += `<line x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}" stroke="#333"/>`;
  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" stroke="#333"/>`;
  scenarios.forEach((label, i) => {
    const cx = margin.left + slot * i + slot / 2;
    const bh = (baselineKeys[i] / max) * plotH;
    const wh = (wamKeys[i] / max) * plotH;
    svg += bar(cx - barW - 2, margin.top + plotH - bh, barW, bh, "#8888cc");
    svg += bar(cx + 2, margin.top + plotH - wh, barW, wh, "#2f9e44");
    svg += text(cx, margin.top + plotH + 18, label, 11);
    svg += text(cx, margin.top + plotH + 32, `${baselineKeys[i]}/${wamKeys[i]}`, 9, "middle");
  });
  svg += `<rect x="${margin.left + plotW - 150}" y="${margin.top}" width="10" height="10" fill="#8888cc"/>`;
  svg += text(margin.left + plotW - 134, margin.top + 9, "baseline", 10, "start");
  svg += `<rect x="${margin.left + plotW - 70}" y="${margin.top}" width="10" height="10" fill="#2f9e44"/>`;
  svg += text(margin.left + plotW - 54, margin.top + 9, "wam", 10, "start");
  svg += `</svg>`;
  return svg;
}

export function tokenConsumptionSvg(suite) {
  const scenarios = suite.results.map((r) => r.scenarioId);
  const baseline = suite.results.map((r) => r.baseline.inputTokens);
  const wam = suite.results.map((r) => r.wam.inputTokens);
  return groupedBarChart("Token Consumption (input tokens)", scenarios, baseline, wam);
}

export function contextConsumptionSvg(suite) {
  const scenarios = suite.results.map((r) => r.scenarioId);
  const baseline = suite.results.map((r) => r.baseline.contextRebuilds);
  const wam = suite.results.map((r) => r.wam.contextRebuilds);
  return groupedBarChart("Context Rebuilds per Scenario", scenarios, baseline, wam);
}

export function savingsDistributionSvg(values) {
  const width = 400;
  const height = 240;
  const margin = { top: 40, right: 20, bottom: 40, left: 40 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const slot = plotW / (values.length || 1);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  svg += text(width / 2, 22, "Savings Distribution (%)", 13);
  const zeroY = margin.top + plotH - ((0 - min) / span) * plotH;
  svg += `<line x1="${margin.left}" y1="${zeroY}" x2="${margin.left + plotW}" y2="${zeroY}" stroke="#333"/>`;
  values.forEach((v, i) => {
    const h = (Math.abs(v) / maxAbs) * (plotH / 2);
    const x = margin.left + slot * i + slot * 0.2;
    const y = v >= 0 ? zeroY - h : zeroY;
    svg += bar(x, y, slot * 0.6, h, v >= 0 ? "#2f9e44" : "#e03131");
    svg += text(x + slot * 0.3, v >= 0 ? y - 4 : y + h + 12, String(v), 9);
  });
  svg += `</svg>`;
  return svg;
}

export function verifiedProgressSvg(suite) {
  const scenarios = suite.results.map((r) => r.scenarioId);
  const baseline = suite.results.map((r) => Math.round(r.baseline.verifiedProgressPer1kInputTokens * 1000));
  const wam = suite.results.map((r) => Math.round(r.wam.verifiedProgressPer1kInputTokens * 1000));
  return groupedBarChart("Verified Progress per 1K input tokens (x1000)", scenarios, baseline, wam);
}

/* ---------------------------------------------------------------------------
 * Causal / validation charts.
 *
 * These consume `computeCausalMetrics()` output (`{ byScenario, totals }`) or
 * `runSnapshotStateValidation()` results, NOT the `runBenchmarkSuite()` shape, so
 * the existing `*Svg(suite)` exports above are untouched.
 *
 * Every function is a pure string builder: no clock, no RNG, no filesystem.
 * Same input -> byte-identical SVG.
 * ------------------------------------------------------------------------- */

const round1 = (n) => Number(Number(n).toFixed(1));

/** Extracts a plain `{ entries, totals }` view of causal metrics, tolerating partial input. */
function causalView(causal) {
  const byScenario = Array.isArray(causal?.byScenario) ? causal.byScenario : [];
  const entries = byScenario.map((e) => ({
    scenarioId: String(e.scenarioId),
    family: String(e.family ?? "unknown"),
    turns: Number(e.turns) || 0,
    contextRebuilds: Number(e.contextRebuilds) || 0,
    fastPathCount: Number(e.fastPathCount) || 0,
    partialRebuildCount: Number(e.partialRebuildCount) || 0,
    fullRebuildCount: Number(e.fullRebuildCount) || 0,
    inputTokens: Number(e.inputTokens) || 0,
    totalTokens: Number(e.totalTokens) || 0,
    baselineTotalTokens: Number(e.baselineTotalTokens) || 0,
  }));
  return { entries, totals: causal?.totals ?? {} };
}

/**
 * Signed reduction % for one scenario: (baseline - wam) / baseline * 100.
 * Signed on purpose — a negative family reports a negative (i.e. cost-adding) reduction.
 */
function reductionPct(entry) {
  if (entry.baselineTotalTokens <= 0) return 0;
  return ((entry.baselineTotalTokens - entry.totalTokens) / entry.baselineTotalTokens) * 100;
}

/** SVG frame. Title only — call sites add geometry and the `data-series` attribute. */
function frame(width, height, title) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    text(width / 2, 22, title, 14)
  );
}

/** Legend swatch + label, drawn inside the plot's top-right corner. */
function legend(x, y, fill, label) {
  return `<rect x="${x}" y="${y}" width="10" height="10" fill="${fill}"/>` + text(x + 16, y + 9, label, 10, "start");
}

/**
 * Bars may go below zero: the scale is fitted to [min, max] (0 always included) so
 * negative values get their own downward-extent and are never clamped away.
 */
function signedAxisBars({
  title,
  labels,
  series,
  width = 640,
  height = 320,
  margin = { top: 40, right: 20, bottom: 60, left: 60 },
  colors = ["#8888cc", "#2f9e44"],
  suffix = "",
}) {
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const flat = series.flatMap((s) => s.values);
  const max = Math.max(0, ...flat);
  const min = Math.min(0, ...flat);
  const span = max - min || 1;
  const yOf = (v) => margin.top + plotH - ((v - min) / span) * plotH;
  const zeroY = yOf(0);
  const slot = plotW / (labels.length || 1);
  const groupW = Math.min(72, slot * 0.7);
  const barW = groupW / (series.length + 1);

  // `data-series` carries the exact plotted values (signed, unclamped) so tests and
  // downstream tooling can read the dataset without re-parsing geometry.
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-labels='${JSON.stringify(labels)}' data-series='${JSON.stringify(series.map((s) => s.values))}'>`;
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  svg += text(width / 2, 22, title, 14);
  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" stroke="#333"/>`;
  svg += `<line x1="${margin.left}" y1="${zeroY}" x2="${margin.left + plotW}" y2="${zeroY}" stroke="#333"/>`;
  svg += text(margin.left - 6, margin.top + 4, `${round1(max)}${suffix}`, 9, "end");
  if (min < 0) svg += text(margin.left - 6, margin.top + plotH, `${round1(min)}${suffix}`, 9, "end");

  labels.forEach((label, i) => {
    const gx = margin.left + slot * i + (slot - groupW) / 2;
    series.forEach((s, si) => {
      const v = s.values[i];
      const y = yOf(v);
      const h = Math.abs(zeroY - y);
      svg += bar(gx + barW * (si + 1), Math.min(y, zeroY), barW, h, colors[si % colors.length]);
    });
    svg += text(margin.left + slot * i + slot / 2, margin.top + plotH + 16, label, 10);
  });

  series.forEach((s, si) => {
    svg += legend(margin.left + plotW - 150 + si * 80, margin.top, colors[si % colors.length], s.name);
  });
  return `${svg}</svg>`;
}

/**
 * "Rebuild vs Token Cost" — rebuild count next to total tokens, per scenario.
 * The pairing is the point: a scenario can be cheap in tokens yet still force a rebuild,
 * and rebuild count is what the continuation family is trying to flatten.
 */
export function rebuildVsTokenSvg(causal) {
  const { entries } = causalView(causal);
  return signedAxisBars({
    title: "Rebuild vs Token Cost (rebuilds vs total tokens)",
    labels: entries.map((e) => e.scenarioId),
    series: [
      { name: "rebuilds", values: entries.map((e) => e.contextRebuilds) },
      { name: "tokens", values: entries.map((e) => e.totalTokens) },
    ],
  });
}

/**
 * "Savings by Scenario" — per-scenario token reduction %.
 * Negative families are rendered downward in red and labelled with their signed value;
 * clamping them to 0 would hide exactly the evidence this layer exists to produce.
 */
export function savingsByScenarioSvg(causal) {
  const { entries } = causalView(causal);
  const values = entries.map(reductionPct);
  return signedAxisBars({
    title: "Savings by Scenario (total token reduction %)",
    labels: entries.map((e) => e.scenarioId),
    series: [{ name: "reduction %", values: values.map(round1) }],
    suffix: "%",
  });
}

/**
 * "Continuation Scaling" — turn count (1/3/5/10/20) against tokens, baseline vs WAM.
 * Baseline grows linearly with turns (one full rebuild per turn) while WAM stays on the
 * fast path, so the widening gap is the avoided-rebuild effect made visible.
 */
export function continuationScalingSvg(causal) {
  const { entries } = causalView(causal);
  const continuation = entries
    .filter((e) => e.family === "continuation")
    .sort((a, b) => a.turns - b.turns);
  return signedAxisBars({
    title: "Continuation Scaling (turns vs tokens)",
    labels: continuation.map((e) => `${e.turns}t`),
    series: [
      { name: "baseline tokens", values: continuation.map((e) => e.baselineTotalTokens) },
      { name: "wam tokens", values: continuation.map((e) => e.totalTokens) },
    ],
  });
}

/**
 * "Snapshot State" — VALID / STALE / INVALID counts from the snapshot-state matrix,
 * split by pass/fail so a green run cannot hide a misclassified case.
 */
export function snapshotStateSvg(snapshotResults) {
  const results = Array.isArray(snapshotResults) ? snapshotResults : [];
  const count = (status) => results.filter((r) => r?.actual?.status === status).length;
  const failed = results.filter((r) => r?.pass !== true).length;
  const statuses = ["VALID", "STALE", "INVALID"];
  const margin = { top: 40, right: 20, bottom: 40, left: 40 };
  const width = 480;
  const height = 260;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const max = Math.max(1, ...statuses.map(count));
  const slot = plotW / statuses.length;
  const barW = slot * 0.5;
  const colors = { VALID: "#2f9e44", STALE: "#f08c00", INVALID: "#e03131" };

  let svg = frame(width, height, "Snapshot State (VALID / STALE / INVALID)");
  svg += `<line x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}" stroke="#333"/>`;
  statuses.forEach((status, i) => {
    const v = count(status);
    const h = (v / max) * plotH;
    const x = margin.left + slot * i + (slot - barW) / 2;
    svg += bar(x, margin.top + plotH - h, barW, h, colors[status]);
    svg += text(x + barW / 2, margin.top + plotH - h - 6, String(v), 11);
    svg += text(x + barW / 2, margin.top + plotH + 18, status, 11);
  });
  svg += text(width / 2, height - 8, `cases: ${results.length} | failed: ${failed}`, 10);
  return `${svg}</svg>`;
}
