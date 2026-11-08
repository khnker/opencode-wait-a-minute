import path from "node:path";

export const CHILD_PATH_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "glob",
  "grep",
  "ls",
  "bash",
  "sh",
  "todowrite",
  "pty_spawn",
]);

/**
 * Extract the path-like argument a tool operates on.
 * @param {object} [args]
 * @returns {string|null}
 */
export function toolPathArgs(args = {}) {
  const value = args.filePath ?? args.path ?? args.directory ?? null;
  return typeof value === "string" ? value : null;
}

/**
 * True when `target` resolves to `root` or a descendant of it.
 * @param {string} target
 * @param {string} root
 * @returns {boolean}
 */
export function isPathInsideRoot(target, root) {
  if (typeof target !== "string" || target === "") return false;
  if (typeof root !== "string" || root === "") return false;
  const resolvedTarget = path.resolve(target);
  const resolvedRoot = path.resolve(root);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

/**
 * Decide whether a child-session tool call stays inside the project root.
 * @param {{tool?: string, args?: object, projectRoot?: string, isChild?: boolean}} params
 * @returns {{allowed: boolean, path: string|null, reason?: string}}
 */
export function checkToolPath({ tool, args = {}, projectRoot, isChild = false } = {}) {
  if (isChild !== true) return { allowed: true, path: null };
  if (!projectRoot) return { allowed: true, path: null };
  if (typeof projectRoot !== "string") {
    return { allowed: false, path: null, reason: "unresolvable-project-root" };
  }
  if (!CHILD_PATH_TOOLS.has(tool)) return { allowed: true, path: null };

  const rawTarget = tool === "bash" || tool === "sh"
    ? (typeof args.cwd === "string" ? args.cwd : null)
    : toolPathArgs(args);
  if (rawTarget === null) return { allowed: true, path: null };

  let resolved;
  try {
    resolved = path.resolve(projectRoot, rawTarget);
  } catch {
    return { allowed: false, path: null, reason: "unresolvable-project-root" };
  }

  if (!isPathInsideRoot(resolved, projectRoot)) {
    return { allowed: false, path: resolved, reason: "path-outside-project-root" };
  }
  return { allowed: true, path: resolved };
}
