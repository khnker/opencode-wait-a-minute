/**
 * WAM runtime configuration.
 *
 * Precedence (highest first):
 *   1. Environment variables (WAM_*)
 *   2. Project config file: <projectRoot>/.wam/config.json
 *   3. Built-in defaults
 *
 * Supported flags (all booleans):
 *   - skills:      discover, route and inject skills into context        (default true)
 *   - logging:     emit WAM logs (file + console)                       (default true)
 *   - enforcement: block mutating tools until the contract is approved   (default true)
 *   - debug:       emit structured WAM-DEBUG traces for auditing logic   (default false)
 *   - autoLoop:    auto-continue after a rejected post-DONE review       (default true)
 *   - permissionPreflight: request access permissions before delegating  (default true)
 *
 * Env overrides:
 *   - skills:      WAM_SKILLS=<bool>       | WAM_DISABLE_SKILLS=1
 *   - logging:     WAM_LOGGING=<bool>      | WAM_SILENT=1 | WAM_DISABLE_LOGGING=1
 *   - enforcement: WAM_ENFORCEMENT=<bool>  | WAM_GOVERNANCE=off | WAM_BYPASS=1
 *   - debug:       WAM_DEBUG=1 | WAM_DEBUG=true | WAM_LOG_LEVEL=debug | WAM_DISABLE_DEBUG=1
 *   - autoLoop:    WAM_AUTO_LOOP=<bool> | WAM_DISABLE_AUTO_LOOP=1
 *   - permissionPreflight: WAM_PERMISSION_PREFLIGHT=<bool> | WAM_DISABLE_PERMISSION_PREFLIGHT=1
 *
 * Config file path override: WAM_CONFIG=<absolute-path-to-config.json>
 *
 * Config file example (.wam/config.json):
 *   { "skills": false, "logging": false, "enforcement": false, "debug": true }
 */
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_WAM_CONFIG = Object.freeze({
  skills: true,
  logging: true,
  enforcement: true,
  debug: true,
  autoLoop: true,
  permissionPreflight: true,
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
  // WAM_CONFIG overrides the default .wam/config.json location entirely.
  const override = process.env.WAM_CONFIG;
  if (override) {
    try {
      if (!fs.existsSync(override)) return {};
      const parsed = JSON.parse(fs.readFileSync(override, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed;
    } catch {
      return {};
    }
  }
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
 * @returns {{skills: boolean, logging: boolean, enforcement: boolean, debug: boolean, autoLoop: boolean, permissionPreflight: boolean}}
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

  const debug = firstDefined(
    parseBoolean(process.env.WAM_DEBUG),
    invert(parseBoolean(process.env.WAM_DISABLE_DEBUG)),
    parseBoolean(process.env.WAM_LOG_LEVEL === "debug" ? "true" : undefined),
    parseBoolean(file.debug),
    DEFAULT_WAM_CONFIG.debug,
  );

  const autoLoop = firstDefined(
    parseBoolean(process.env.WAM_AUTO_LOOP),
    invert(parseBoolean(process.env.WAM_DISABLE_AUTO_LOOP)),
    parseBoolean(file.autoLoop),
    DEFAULT_WAM_CONFIG.autoLoop,
  );

  const permissionPreflight = firstDefined(
    parseBoolean(process.env.WAM_PERMISSION_PREFLIGHT),
    invert(parseBoolean(process.env.WAM_DISABLE_PERMISSION_PREFLIGHT)),
    parseBoolean(file.permissionPreflight),
    DEFAULT_WAM_CONFIG.permissionPreflight,
  );

  return { skills, logging, enforcement, debug, autoLoop, permissionPreflight };
}
