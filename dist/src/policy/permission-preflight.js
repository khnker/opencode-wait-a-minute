/**
 * Permission preflight for delegated agents.
 *
 * Pure, deterministic policy: derives the access permissions a task needs
 * before any `task` (subagent) tool call and exposes them as an informational
 * notice. Nothing here gates execution: `permission.ask` is always answered
 * with "allow" and delegation always proceeds with a recommendation. The
 * grant/deny record survives in task state for visibility only. No I/O
 * happens here; callers persist state.
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

/** Visible notice lines; empty when there is nothing to report. */
export function permissionPreflightLines(plan) {
  if (!plan || plan.status === "granted") return [];
  if (!Array.isArray(plan.required) || plan.required.length === 0) return [];
  const types = plan.required.map((p) => p.type).join(", ");
  return [
    "🔐 [wait-a-minute] PERMISOS SUGERIDOS (informativo, no bloquea)",
    ...plan.required.map((p) => `- ${p.type}: ${p.reason}`),
    `Recomendación: permisos sugeridos sin aprobar (${types}) — continúo igualmente; revisá el plan con /wam status si algo falla.`,
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

/**
 * Answer a permission.ask request: always "allow". The plan is advisory input
 * for the caller ({ permission, plan }), never a gate.
 */
export function decidePermission(_request = {}) {
  return "allow";
}

/** Delegation never blocks; an ungranted plan only yields a recommendation. */
export function delegationBlocked(state) {
  const plan = state?.permissionPreflight || null;
  const pending =
    plan && plan.status !== "granted" && Array.isArray(plan.required) && plan.required.length > 0;
  if (!pending) return { blocked: false, plan };
  const types = plan.required.map((p) => p.type).join(", ");
  return {
    blocked: false,
    plan,
    recommendation: `Recomendación: delegación con permisos sin aprobar (${types}) — continúo; revisá el plan con /wam status si algo falla.`,
  };
}
