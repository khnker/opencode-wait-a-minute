/**
 * Permission preflight for delegated agents.
 *
 * Pure, deterministic policy: derives the access permissions a task needs
 * before any `task` (subagent) tool call, exposes them as a visible notice,
 * records the grant/deny decision in task state, and answers opencode's
 * `permission.ask` hook. No I/O happens here; callers persist state.
 */

export const PERMISSION_TYPES = ["edit", "bash", "webfetch", "external_directory"];

const BASH_RE = /\b(test|tests|build|lint|npm|node|pnpm|yarn|git|script|install|curl|bash|command|run)\b/i;
const WEB_RE = /(https?:\/\/|\bweb\b|\bfetch\b|\bdocs?\b|\burl\b)/i;
const EXTERNAL_RE = /(\/tmp\b|\/home\/|\/etc\/|\/var\/|~\/|\.\.\/|external)/i;

function flattenText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return String(value);
}

function taskText(state, promptText) {
  const requirements = Array.isArray(state?.requirements) ? state.requirements : [];
  return [
    state?.objective,
    ...requirements.map((r) => r?.title),
    state?.verification,
    state?.contract?.verification,
    promptText,
  ].map(flattenText).join(" ");
}

/**
 * Derive the permission plan for a task without mutating it.
 * @returns {{required: Array<{type: string, reason: string}>, status: "pending", granted: string[], approvedAt: null}}
 */
export function derivePermissionPlan({ state, promptText = "" } = {}) {
  const text = taskText(state, promptText);
  const found = new Map();

  if (state?.contract) {
    found.set("edit", "La implementación aprobada requiere editar archivos");
  }
  if (BASH_RE.test(text)) {
    found.set("bash", "La tarea ejecuta comandos (tests, build o scripts)");
  }
  if (WEB_RE.test(text)) {
    found.set("webfetch", "La tarea consulta URLs o documentación externa");
  }
  if (EXTERNAL_RE.test(text)) {
    found.set("external_directory", "La tarea accede a rutas fuera del proyecto");
  }

  return {
    required: PERMISSION_TYPES.filter((type) => found.has(type)).map((type) => ({
      type,
      reason: found.get(type),
    })),
    status: "pending",
    granted: [],
    approvedAt: null,
  };
}

/**
 * Ensure the task state carries a plan. Returns null when the contract is not
 * approved or no plan can be derived. Existing plans are never overwritten so a
 * prior grant/deny survives re-entry.
 */
export function ensurePermissionPlan(state, { promptText = "" } = {}) {
  if (!state?.contract || state.contract.status !== "APPROVED") return null;
  if (state.permissionPreflight && Array.isArray(state.permissionPreflight.required)) {
    return state.permissionPreflight;
  }
  const plan = derivePermissionPlan({ state, promptText });
  state.permissionPreflight = plan;
  return plan;
}

/** Visible notice lines; empty when there is nothing to request. */
export function permissionPreflightLines(plan) {
  if (!plan || plan.status === "granted") return [];
  if (!Array.isArray(plan.required) || plan.required.length === 0) return [];
  return [
    "🔐 [wait-a-minute] PERMISOS REQUERIDOS ANTES DE DELEGAR",
    ...plan.required.map((p) => `- ${p.type}: ${p.reason}`),
    "Aprobar: /wam permissions approve | Denegar: /wam permissions deny",
  ];
}

export function grantPermissionPlan(state, { at = Date.now() } = {}) {
  const plan = state?.permissionPreflight;
  if (!plan) return null;
  plan.status = "granted";
  plan.granted = (plan.required || []).map((p) => p.type);
  plan.approvedAt = at;
  return plan;
}

export function denyPermissionPlan(state, { at = Date.now() } = {}) {
  const plan = state?.permissionPreflight;
  if (!plan) return null;
  plan.status = "denied";
  plan.granted = [];
  plan.approvedAt = at;
  return plan;
}

/** Answer a permission.ask request: allow only an explicitly granted type. */
export function decidePermission({ permission, plan } = {}) {
  if (plan?.status !== "granted") return "ask";
  if (!Array.isArray(plan.granted) || !plan.granted.includes(permission?.type)) return "ask";
  return "allow";
}

/** Block delegation until the whole plan is granted. */
export function delegationBlocked(state) {
  const plan = state?.permissionPreflight || null;
  const blocked = Boolean(
    plan && plan.status !== "granted" && Array.isArray(plan.required) && plan.required.length > 0,
  );
  return { blocked, plan };
}
