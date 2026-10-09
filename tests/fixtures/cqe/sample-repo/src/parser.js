import { parseConfig } from "./config.js";

export function parseConfigLegacy(raw) {
  return raw.split(",").map((s) => s.trim());
}

export function buildOptions(raw) {
  const cfg = parseConfig(raw);
  cfg.source = "parser";
  return cfg;
}
