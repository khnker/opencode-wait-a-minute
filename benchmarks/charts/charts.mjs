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
