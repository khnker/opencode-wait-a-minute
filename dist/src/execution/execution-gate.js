const MUTATING_TOOLS = new Set([
  "write",
  "edit",
  "patch",
  "multiedit",
  "apply_patch",
  "applypatch",
  "str_replace_editor",
]);

const BASH_MUTATION_RE = /(^|[;&|]\s*)(rm|mv|cp|touch|mkdir|rmdir|sed\s+-i|perl\s+-pi|tee|truncate|git\s+(apply|commit|checkout|reset|clean|merge|rebase|stash\s+(push|pop|apply)))\b|(^|\s)(>|>>)\s*\S/;

export function isMutatingToolCall(tool, args = {}) {
  const name = String(tool || "").toLowerCase();
  if (MUTATING_TOOLS.has(name)) return true;
  if (name === "bash" || name === "sh") {
    const command = String(args?.command ?? args?.cmd ?? "");
    return BASH_MUTATION_RE.test(command);
  }
  return false;
}

export function isExecutionGateActive(task) {
  return task?.executionGate?.active === true;
}

export function executionGateDirective(gate) {
  const reason = gate?.reason === "analysis-loop"
    ? "el pipeline de análisis read-only"
    : "el loop de agentes";
  return `[wait-a-minute] WAM: ${reason} está evaluando la tarea; las ediciones están bloqueadas hasta que termine. Usá lectura y análisis mientras tanto.`;
}
