export function classifyBash(command) {
  if (!command || typeof command !== "string") {
    return { kind: "justified", primary: "", reason: "empty or non-string command" };
  }

  // Strip leading cd <dir> && and env prefixes (e.g. FOO=bar command)
  let clean = command.trim();
  
  // Handle cd prefix: cd <dir> && ...
  const cdMatch = clean.match(/^cd\s+([^\s&]+)\s*&&\s*(.*)$/);
  if (cdMatch) {
    clean = cdMatch[2].trim();
  }

  // Strip common env assignments like NODE_ENV=production or FOO=bar
  // Repeat to strip multiple if any
  while (true) {
    const envMatch = clean.match(/^[A-Z_][A-Z0-9_]*=[^\s]+\s+(.*)$/);
    if (envMatch) {
      clean = envMatch[1].trim();
    } else {
      break;
    }
  }

  if (!clean) {
    return { kind: "justified", primary: "", reason: "empty command after stripping" };
  }

  // Check for output redirection (> or >>)
  if (/(?:^|\s)>{1,2}\s*[\w.-]+/.test(clean)) {
    return { kind: "justified", primary: clean, reason: "contains output redirection" };
  }

  // Check for mutating commands or build/script runners / git commit etc.
  const mutatingOrBuildKeywords = /\b(npm|pnpm|yarn|node|python|pip|git\s+commit|git\s+push|git\s+pull|rm|rmdir|mkdir|touch|cp|mv|wget|curl)\b/i;
  if (mutatingOrBuildKeywords.test(clean)) {
    return { kind: "justified", primary: clean, reason: "contains build, script runner, or mutating command" };
  }

  // Check for multi-command pipes that are NOT purely filtering/counting
  // Allowed filters/counters: grep, rg, wc, head, tail, sort, uniq, awk, sed (if read-only? wait, prompt says: "Pipelines that only filter (e.g. grep x | wc -l) stay read-only; anything writing or running a build/script is 'justified'")
  const parts = clean.split(/\s*\|\s*/);
  const primary = parts[0].trim().split(/\s+/)[0];

  const allowedDiscoveryTools = new Set(["grep", "rg", "find", "cat", "head", "tail", "ls", "tree", "wc"]);

  if (!allowedDiscoveryTools.has(primary)) {
    return { kind: "justified", primary, reason: `primary command '${primary}' is not a discovery tool` };
  }

  // Check remaining pipeline parts
  const allowedPipelineFilters = new Set(["grep", "rg", "wc", "head", "tail", "sort", "uniq", "awk", "sed", "cat"]);
  for (let i = 1; i < parts.length; i++) {
    const pCmd = parts[i].trim().split(/\s+/)[0];
    if (!allowedPipelineFilters.has(pCmd)) {
      return { kind: "justified", primary, reason: `pipeline contains non-filtering command '${pCmd}'` };
    }
  }

  return { kind: "read-only", primary, reason: "pure read-only discovery or filtering pipeline" };
}

export function nudgeFor(command) {
  const classification = classifyBash(command);
  if (classification.kind !== "read-only") {
    return null;
  }
  const primary = classification.primary;
  if (primary === "grep" || primary === "rg") {
    return "Consider using the dedicated 'grep' tool or 'context-query-engine' MCP (search_files / context_query) instead of raw bash search.";
  }
  if (primary === "ls" || primary === "find" || primary === "tree") {
    return "Consider using the dedicated 'glob' tool instead of raw bash file listing/finding.";
  }
  if (primary === "cat" || primary === "head" || primary === "tail") {
    return "Consider using the dedicated 'read' tool or 'context-query-engine' MCP (read_file) instead of raw bash file reading.";
  }
  return "Consider using dedicated tools (`grep`, `glob`, `read`) or the `context-query-engine` MCP instead of raw bash discovery.";
}

export function workdirSuggestion(command) {
  if (!command || typeof command !== "string") return null;
  const match = command.trim().match(/^cd\s+([^\s&]+)\s*&&\s*(.*)$/);
  if (match) {
    const dir = match[1];
    return `Consider using the 'workdir' parameter ('workdir: "${dir}"') instead of 'cd ${dir} && ...' in bash.`;
  }
  return null;
}

export function evaluateDiscovery(tool, args) {
  try {
    if (String(tool).toLowerCase() !== "bash") {
      return null;
    }
    const command = args?.command || args?.cmd || "";
    const classification = classifyBash(command);
    const nudge = nudgeFor(command);
    const workdir = workdirSuggestion(command);

    return {
      kind: classification.kind,
      nudge,
      workdir,
    };
  } catch (err) {
    return null;
  }
}
