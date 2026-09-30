export function normalizeText(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isEquivalent(a, b) {
  return normalizeText(a) === normalizeText(b);
}

export function equivalenceRate(pairs) {
  if (!pairs || pairs.length === 0) return 0;
  const equivalent = pairs.filter(([a, b]) => isEquivalent(a, b));
  return Number(((equivalent.length / pairs.length) * 100).toFixed(2));
}
