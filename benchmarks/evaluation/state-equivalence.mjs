import { createHash } from "node:crypto";

export function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

export function logicalStateHash(input) {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

export function stateEquivalent(a, b) {
  return a === b;
}

export function assertEquivalentState({ baselineHash, wamHash }) {
  if (!stateEquivalent(baselineHash, wamHash)) {
    throw new Error("state mismatch: baseline and WAM arms received different logical states");
  }
  return true;
}
