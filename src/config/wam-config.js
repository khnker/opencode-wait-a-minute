/**
 * WAM runtime configuration.
 *
 * Precedence (highest first):
 *   1. Environment variables (WAM_*)
 *   2. Project config file: <projectRoot>/.wam/config.json
 *   3. Built-in defaults
 *
 * Supported flags (all booleans, default true):
 *   - skills:      discover, route and inject skills into context
 *   - logging:     emit WAM logs (file + console)
 *   - enforcement: block mutating tools until the contract is approved
 *
 * Env overrides:
 *   - skills:      WAM_SKILLS=<bool>       | WAM_DISABLE_SKILLS=1
 *   - logging:     WAM_LOGGING=<bool>      | WAM_SILENT=1 | WAM_DISABLE_LOGGING=1
 *   - enforcement: WAM_ENFORCEMENT=<bool>  | WAM_GOVERNANCE=off | WAM_BYPASS=1
 *
 * Config file example (.wam/config.json):
 *   { "skills": false, "logging": false, "enforcement": false }
 */
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_WAM_CONFIG = Object.freeze({
  skills: true,
  logging: true,
  enforcement: true,
});

const TRUE_VALUES = new Set(["1", "true", "on", "yes", "enabled", "enable"]);
const FALSE_VALUES = new Set(["0", "false", "off", "no", "disabled", "disable"]);

export function parseBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const v = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  return undefined;
}

function firstDefined(...values) {
  for (const v of values) if (v !== undefined) return v;
  return undefined;
}

function invert(value) {
  return value === undefined ? undefined : !value;
}

function governanceEnvOverride() {
  const v = String(process.env.WAM_GOVERNANCE || "").trim().toLowerCase();
  if (FALSE_VALUES.has(v)) return false;
  if (process.env.WAM_BYPASS === "1") return false;
  if (TRUE_VALUES.has(v)) return true;
  return undefined;
}

export function readConfigFile(baseDir) {
  try {
    const file = path.join(baseDir || process.cwd(), ".wam", "config.json");
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

/**
 * Resolve the effective WAM config for a project root.
 * @param {string} [baseDir]
 * @returns {{skills: boolean, logging: boolean, enforcement: boolean}}
 */
export function loadWamConfig(baseDir = process.cwd()) {
  const file = readConfigFile(baseDir);

  const skills = firstDefined(
    parseBoolean(process.env.WAM_SKILLS),
    invert(parseBoolean(process.env.WAM_DISABLE_SKILLS)),
    parseBoolean(file.skills),
    DEFAULT_WAM_CONFIG.skills,
  );

  const logging = firstDefined(
    parseBoolean(process.env.WAM_LOGGING),
    invert(parseBoolean(process.env.WAM_SILENT)),
    invert(parseBoolean(process.env.WAM_DISABLE_LOGGING)),
    parseBoolean(file.logging),
    DEFAULT_WAM_CONFIG.logging,
  );

  const enforcement = firstDefined(
    parseBoolean(process.env.WAM_ENFORCEMENT),
    governanceEnvOverride(),
    parseBoolean(file.enforcement),
    DEFAULT_WAM_CONFIG.enforcement,
  );

  return { skills, logging, enforcement };
}
