import { loadPrompt } from "../prompts/loader.js";

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
  // Split en pipes reales: ignora \| escapados y pipes dentro de comillas
  // simples/dobles (p.ej. grep "a\|b" es UN stage, no dos).
  const parts = splitPipeline(clean);
  const primary = parts[0].trim().split(/\s+/)[0];

  const allowedDiscoveryTools = new Set(["grep", "rg", "find", "cat", "head", "tail", "ls", "tree", "wc"]);

  if (!allowedDiscoveryTools.has(primary)) {
    return { kind: "justified", primary, reason: `primary command '${primary}' is not a discovery tool` };
  }

  // Check remaining pipeline parts
  const allowedPipelineFilters = new Set(["grep", "rg", "wc", "head", "tail", "sort", "uniq", "awk", "sed", "cat"]);
  for (let i = 1; i < parts.length; i++) {
    const stage = parts[i].trim();
    const pCmd = stage.split(/\s+/)[0];
    if (pCmd === "xargs") {
      // `... | xargs grep|rg ...` sigue siendo búsqueda read-only; cualquier
      // otro subcomando vía xargs puede mutar → justified.
      const rest = stage.split(/\s+/).slice(1).filter((t) => !/^-[a-zA-Z0-9-]+$/.test(t) && !/^[{}+]+$/.test(t));
      const sub = (rest[0] || "").split("/").pop();
      if (sub !== "grep" && sub !== "rg") {
        return { kind: "justified", primary, reason: `pipeline contains non-filtering command 'xargs ${sub || "?"}'` };
      }
      continue;
    }
    if (!allowedPipelineFilters.has(pCmd)) {
      return { kind: "justified", primary, reason: `pipeline contains non-filtering command '${pCmd}'` };
    }
  }

  return { kind: "read-only", primary, reason: "pure read-only discovery or filtering pipeline" };
}

function splitPipeline(clean) {
  const parts = [];
  let cur = "";
  let sq = false;
  let dq = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "\\") {
      cur += ch + (clean[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === "'" && !dq) { sq = !sq; cur += ch; continue; }
    if (ch === '"' && !sq) { dq = !dq; cur += ch; continue; }
    if (ch === "|" && !sq && !dq) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function nudgeFor(command) {
  const classification = classifyBash(command);
  if (classification.kind !== "read-only") {
    return null;
  }
  const primary = classification.primary;
  if (primary === "grep" || primary === "rg") {
    return loadPrompt("nudge.discovery.grep");
  }
  if (primary === "ls" || primary === "find" || primary === "tree") {
    return loadPrompt("nudge.discovery.glob");
  }
  if (primary === "cat" || primary === "head" || primary === "tail") {
    return loadPrompt("nudge.discovery.read");
  }
  return loadPrompt("nudge.discovery.default");
}

export function workdirSuggestion(command) {
  if (!command || typeof command !== "string") return null;
  const match = command.trim().match(/^cd\s+([^\s&]+)\s*&&\s*(.*)$/);
  if (match) {
    const dir = match[1];
    return loadPrompt("nudge.discovery.workdir", { dir });
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
