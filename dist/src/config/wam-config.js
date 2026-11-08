/**
 * WAM runtime configuration.
 *
 * Precedence (highest first):
 *   1. Environment variables (WAM_*)
 *   2. Project config file: <projectRoot>/.wam/config.json
 *   3. Global config file (see below)
 *   4. Built-in defaults
 *
 * Global config path (first match wins):
 *   - WAM_GLOBAL_CONFIG=<path>
 *   - $XDG_CONFIG_HOME/wam/config.json
 *   - ~/.config/wam/config.json
 *
 * Global and project files are deep-merged (project wins). WAM_CONFIG replaces
 * the file location entirely and disables the global merge.
 *
 * Supported flags (all booleans):
 *   - skills:      discover, route and inject skills into context        (default true)
 *   - logging:     emit WAM logs (file + console)                       (default true)
 *   - enforcement: block mutating tools until the contract is approved   (default true)
 *   - debug:       emit structured WAM-DEBUG traces for auditing logic   (default false)
 *   - autoLoop:    auto-continue after a rejected post-DONE review       (default true)
 *   - permissionPreflight: request access permissions before delegating  (default true)
 *   - permissionEnforce: hard-enforce permission decisions              (default false)
 *   - contractApproval: "required" pauses writes until /wam contract approve;
 *                       "advisory" proceeds after a recommendation       (default advisory)
 *   - taskLoop:    drive the execution loop after session.idle           (default enabled)
 *   - qualityContracts: enforce task-specific evidence requirements      (default disabled)
 *
 * Env overrides:
 *   - skills:      WAM_SKILLS=<bool>       | WAM_DISABLE_SKILLS=1
 *   - logging:     WAM_LOGGING=<bool>      | WAM_SILENT=1 | WAM_DISABLE_LOGGING=1
 *   - enforcement: WAM_ENFORCEMENT=<bool>  | WAM_GOVERNANCE=off | WAM_BYPASS=1
 *   - debug:       WAM_DEBUG=1 | WAM_DEBUG=true | WAM_LOG_LEVEL=debug | WAM_DISABLE_DEBUG=1
 *   - autoLoop:    WAM_AUTO_LOOP=<bool> | WAM_DISABLE_AUTO_LOOP=1
 *   - permissionPreflight: WAM_PERMISSION_PREFLIGHT=<bool> | WAM_DISABLE_PERMISSION_PREFLIGHT=1
 *   - permissionEnforce: WAM_PERMISSION_ENFORCE=<bool>
 *   - contractApproval: WAM_CONTRACT_APPROVAL=required|advisory
 *   - task loop agents: WAM_TASK_LOOP_AGENTS=1, WAM_AGENT_MAX_REVISIONS=<int>,
 *     WAM_AGENT_MAX_REPLANS=<int>, WAM_AGENT_MAX_HISTORY=<int>,
 *     WAM_AGENT_TOOL_TIMEOUT_MS=<positive-int>, WAM_AGENT_EARLY_PASS=<bool>
 *
 * Config file path override: WAM_CONFIG=<absolute-path-to-config.json>
 * Global config path override: WAM_GLOBAL_CONFIG=<absolute-path-to-config.json>
 *
 * Config file example (.wam/config.json):
 *   { "skills": false, "logging": false, "enforcement": false, "debug": true }
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_WAM_CONFIG = Object.freeze({
  skills: true,
  logging: true,
  enforcement: true,
  debug: true,
  autoLoop: true,
  permissionPreflight: true,
  permissionEnforce: false,
  contractApproval: "advisory",
  contextProjection: "active",
  taskLoop: Object.freeze({
    enabled: true,
    maxIterations: 10,
    maxNoProgress: 3,
    agents: Object.freeze({
      enabled: false,
      maxRevisionCycles: 2,
      maxReplanCycles: 1,
      maxAttempts: 2,
      maxConsecutiveFailures: 3,
      maxHistory: 5,
      toolTimeoutMs: 120000,
    }),
  }),
  qualityContracts: Object.freeze({ enabled: false }),
  completionGate: Object.freeze({ enforce: false }),
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

function parseContractApproval(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const v = String(value).trim().toLowerCase();
  if (["required", "require", "strict", "approve", "approval"].includes(v)) return "required";
  if (["advisory", "auto", "off", "none"].includes(v)) return "advisory";
  return undefined;
}

function invert(value) {
  return value === undefined ? undefined : !value;
}

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function parseNonNegativeInt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Resolve the global WAM config path.
 * WAM_GLOBAL_CONFIG wins; else XDG_CONFIG_HOME; else ~/.config/wam/config.json.
 * @returns {string}
 */
export function resolveGlobalConfigPath() {
  const override = (process.env.WAM_GLOBAL_CONFIG || "").trim();
  if (override) return override;
  const xdg = (process.env.XDG_CONFIG_HOME || "").trim();
  if (xdg) return path.join(xdg, "wam", "config.json");
  return path.join(os.homedir(), ".config", "wam", "config.json");
}

/**
 * Read the global config file. Missing, malformed or non-object content => {}.
 * @returns {object}
 */
export function readGlobalConfigFile() {
  try {
    const file = resolveGlobalConfigPath();
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (value === undefined) continue;
    result[key] =
      isPlainObject(value) && isPlainObject(result[key])
        ? deepMerge(result[key], value)
        : value;
  }
  return result;
}

function readMergedConfigFile(baseDir) {
  const project = readConfigFile(baseDir);
  // WAM_CONFIG replaces the file location entirely: never merge the global file.
  if (process.env.WAM_CONFIG) return project;
  return deepMerge(readGlobalConfigFile(), project);
}

/**
 * Resolve the effective WAM config for a project root.
 * @param {string} [baseDir]
 * @returns {{skills: boolean, logging: boolean, enforcement: boolean, debug: boolean, autoLoop: boolean, permissionPreflight: boolean, contractApproval: "advisory"|"required", contextProjection: string}}
 */
export function loadWamConfig(baseDir = process.cwd()) {
  const file = readMergedConfigFile(baseDir);

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

  const permissionEnforce = firstDefined(
    parseBoolean(process.env.WAM_PERMISSION_ENFORCE),
    parseBoolean(file.permissionEnforce),
    DEFAULT_WAM_CONFIG.permissionEnforce,
  );

  const contractApproval = firstDefined(
    parseContractApproval(process.env.WAM_CONTRACT_APPROVAL),
    parseContractApproval(file.contractApproval),
    DEFAULT_WAM_CONFIG.contractApproval,
  );

  const fileTaskLoop = file.taskLoop && typeof file.taskLoop === "object" ? file.taskLoop : {};
  const fileTaskLoopAgents =
    fileTaskLoop.agents && typeof fileTaskLoop.agents === "object" ? fileTaskLoop.agents : {};
  const fileQualityContracts = file.qualityContracts && typeof file.qualityContracts === "object" ? file.qualityContracts : {};
  const fileCompletionGate = file.completionGate && typeof file.completionGate === "object" ? file.completionGate : {};

  return {
    skills,
    logging,
    enforcement,
    debug,
    autoLoop,
    permissionPreflight,
    permissionEnforce,
    contractApproval,
    contextProjection: firstDefined(
      process.env.WAM_CONTEXT_PROJECTION,
      typeof file.contextProjection === "string" ? file.contextProjection : undefined,
      DEFAULT_WAM_CONFIG.contextProjection,
    ),
    taskLoop: {
      enabled: firstDefined(
        parseBoolean(process.env.WAM_TASK_LOOP),
        parseBoolean(fileTaskLoop.enabled),
        DEFAULT_WAM_CONFIG.taskLoop.enabled,
      ),
      maxIterations: firstDefined(
        parsePositiveInt(process.env.WAM_TASK_LOOP_MAX_ITERATIONS),
        parsePositiveInt(fileTaskLoop.maxIterations),
        DEFAULT_WAM_CONFIG.taskLoop.maxIterations,
      ),
      maxNoProgress: firstDefined(
        parsePositiveInt(process.env.WAM_TASK_LOOP_MAX_NO_PROGRESS),
        parsePositiveInt(fileTaskLoop.maxNoProgress),
        DEFAULT_WAM_CONFIG.taskLoop.maxNoProgress,
      ),
      agents: {
        enabled: firstDefined(
          parseBoolean(process.env.WAM_TASK_LOOP_AGENTS),
          parseBoolean(fileTaskLoopAgents.enabled),
          DEFAULT_WAM_CONFIG.taskLoop.agents.enabled,
        ),
        maxRevisionCycles: firstDefined(
          parseNonNegativeInt(process.env.WAM_AGENT_MAX_REVISIONS),
          parseNonNegativeInt(fileTaskLoopAgents.maxRevisionCycles),
          DEFAULT_WAM_CONFIG.taskLoop.agents.maxRevisionCycles,
        ),
        maxReplanCycles: firstDefined(
          parseNonNegativeInt(process.env.WAM_AGENT_MAX_REPLANS),
          parseNonNegativeInt(fileTaskLoopAgents.maxReplanCycles),
          DEFAULT_WAM_CONFIG.taskLoop.agents.maxReplanCycles,
        ),
        maxAttempts: firstDefined(
          parsePositiveInt(process.env.WAM_AGENT_MAX_ATTEMPTS),
          parsePositiveInt(fileTaskLoopAgents.maxAttempts),
          DEFAULT_WAM_CONFIG.taskLoop.agents.maxAttempts,
        ),
        maxConsecutiveFailures: firstDefined(
          parsePositiveInt(process.env.WAM_AGENT_MAX_CONSECUTIVE_FAILURES),
          parsePositiveInt(fileTaskLoopAgents.maxConsecutiveFailures),
          DEFAULT_WAM_CONFIG.taskLoop.agents.maxConsecutiveFailures,
        ),
        maxHistory: firstDefined(
          parseNonNegativeInt(process.env.WAM_AGENT_MAX_HISTORY),
          parseNonNegativeInt(fileTaskLoopAgents.maxHistory),
          DEFAULT_WAM_CONFIG.taskLoop.agents.maxHistory,
        ),
        toolTimeoutMs: firstDefined(
          parsePositiveInt(process.env.WAM_AGENT_TOOL_TIMEOUT_MS),
          parsePositiveInt(fileTaskLoopAgents.toolTimeoutMs),
          DEFAULT_WAM_CONFIG.taskLoop.agents.toolTimeoutMs,
        ),
      },
    },
    qualityContracts: {
      enabled: firstDefined(
        parseBoolean(process.env.WAM_QUALITY_CONTRACTS),
        parseBoolean(fileQualityContracts.enabled),
        DEFAULT_WAM_CONFIG.qualityContracts.enabled,
      ),
    },
    completionGate: {
      enforce: firstDefined(
        parseBoolean(process.env.WAM_COMPLETION_GATE),
        parseBoolean(process.env.WAM_COMPLETION_GATE_ENFORCE),
        parseBoolean(fileCompletionGate.enforce),
        DEFAULT_WAM_CONFIG.completionGate.enforce,
      ),
    },
  };
}
