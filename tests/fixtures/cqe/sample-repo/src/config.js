import fs from "node:fs";
import path from "node:path";

export function parseConfig(raw) {
  const out = {};
  for (const line of String(raw).split("\n")) {
    const [k, v] = line.split("=");
    if (k) out[k.trim()] = (v ?? "").trim();
  }
  return out;
}

export function loadConfig(filePath) {
  return parseConfig(fs.readFileSync(filePath, "utf8"));
}

export const CONFIG_PATH = path.join(process.cwd(), "wam.config");
