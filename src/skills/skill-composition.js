import fs from "node:fs";
import path from "node:path";

export function parseFrontmatter(text) {
  const src = String(text ?? "");
  if (!src.startsWith("---\n")) {
    return { data: {}, body: src };
  }
  const rest = src.slice(4);
  const closeIdx = rest.indexOf("\n---");
  if (closeIdx === -1) {
    return { data: {}, body: src };
  }
  const headerLines = rest.slice(0, closeIdx).split("\n");
  const body = rest.slice(closeIdx + 4);
  const bodyNormalized = body.startsWith("\n") ? body.slice(1) : body;
  const { data } = parseHeader(headerLines);
  return { data, body: bodyNormalized };
}

function parseHeader(lines) {
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) {
      i += 1;
      continue;
    }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) {
      i += 1;
      continue;
    }
    const key = m[1];
    const tail = m[2];
    if (tail === "" || tail === "|") {
      const items = [];
      i += 1;
      while (i < lines.length) {
        const sub = lines[i];
        const blockMatch = sub.match(/^\s+-\s+(.+?)\s*$/);
        if (!blockMatch) break;
        items.push(stripQuotes(blockMatch[1].trim()));
        i += 1;
      }
      data[key] = items;
      continue;
    }
    if (tail.startsWith("[") && tail.endsWith("]")) {
      const inner = tail.slice(1, -1).trim();
      if (inner === "") {
        data[key] = [];
      } else {
        data[key] = inner
          .split(",")
          .map((s) => stripQuotes(s.trim()))
          .filter((s) => s.length > 0);
      }
      i += 1;
      continue;
    }
    data[key] = coerceScalar(stripQuotes(tail));
    i += 1;
  }
  return { data };
}

function coerceScalar(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (v !== "" && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) {
    return Number(v);
  }
  return v;
}

function stripQuotes(v) {
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return v.slice(1, -1);
    }
  }
  return v;
}

export function toContract(data) {
  const d = data ?? {};
  return {
    id: d.name,
    inputs: toArr(d.inputs),
    outputs: toArr(d.outputs),
    requires: toArr(d.requires),
    optional: toArr(d.optional),
    fallback: d.fallback == null ? null : d.fallback,
  };
}

function toArr(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.slice();
  return [v];
}

export function buildSkillGraph(contractsById) {
  const ids = Object.keys(contractsById).sort();
  const nodes = [];
  const edges = [];
  const nodeIndex = new Map();
  for (const id of ids) {
    const c = contractsById[id];
    nodes.push({
      id,
      outputs: c.outputs.slice(),
      requires: c.requires.slice(),
      optional: c.optional.slice(),
    });
    nodeIndex.set(id, nodes.length - 1);
  }
  for (const id of ids) {
    const c = contractsById[id];
    for (const r of c.requires) {
      if (nodeIndex.has(r)) {
        edges.push({ from: r, to: id, kind: "required" });
      }
    }
    for (const o of c.optional) {
      if (nodeIndex.has(o)) {
        edges.push({ from: o, to: id, kind: "optional" });
      }
    }
  }
  return { nodes, edges };
}

export function detectCycle(graph) {
  const requiredEdges = (graph.edges || []).filter((e) => e.kind === "required");
  const adj = new Map();
  const allIds = new Set((graph.nodes || []).map((n) => n.id));
  for (const e of requiredEdges) {
    allIds.add(e.from);
    allIds.add(e.to);
  }
  for (const id of allIds) {
    if (!adj.has(id)) adj.set(id, []);
  }
  for (const e of requiredEdges) {
    adj.get(e.from).push(e.to);
  }
  const visited = new Set();
  const stack = new Set();
  const path = [];
  function dfs(u) {
    if (stack.has(u)) {
      const idx = path.indexOf(u);
      return idx >= 0 ? path.slice(idx).concat([u]) : [u, u];
    }
    if (visited.has(u)) return null;
    visited.add(u);
    stack.add(u);
    path.push(u);
    const succs = (adj.get(u) || []).slice().sort();
    for (const v of succs) {
      const found = dfs(v);
      if (found) return found;
    }
    path.pop();
    stack.delete(u);
    return null;
  }
  const nodeIds = Array.from(allIds).sort();
  for (const id of nodeIds) {
    const found = dfs(id);
    if (found) return found;
  }
  return null;
}

export function topoSort(graph) {
  const cycle = detectCycle(graph);
  if (cycle) {
    const msg = cycle.slice(0, -1).join(" -> ");
    throw new Error(`skill dependency cycle: ${msg} -> ${cycle[0]}`);
  }
  const requiredEdges = (graph.edges || []).filter((e) => e.kind === "required");
  const indeg = new Map();
  const adj = new Map();
  const nodeIds = (graph.nodes || []).map((n) => n.id).sort();
  for (const id of nodeIds) {
    indeg.set(id, 0);
    adj.set(id, []);
  }
  for (const e of requiredEdges) {
    if (!indeg.has(e.from)) continue;
    if (!indeg.has(e.to)) continue;
    adj.get(e.from).push(e.to);
    indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
  }
  const ready = nodeIds.filter((id) => (indeg.get(id) || 0) === 0);
  const out = [];
  while (ready.length > 0) {
    const id = ready.shift();
    out.push(id);
    const succ = (adj.get(id) || []).slice().sort();
    for (const s of succ) {
      indeg.set(s, indeg.get(s) - 1);
      if (indeg.get(s) === 0) {
        const pos = ready.findIndex((x) => x > s);
        if (pos === -1) ready.push(s);
        else ready.splice(pos, 0, s);
      }
    }
  }
  return out;
}

export function validateActivation(graph, produced = []) {
  const order = topoSort(graph);
  const producedSet = new Set(produced);
  const errors = [];
  for (const node of graph.nodes || []) {
    const missing = node.requires.filter((r) => !producedSet.has(r));
    if (missing.length > 0) {
      errors.push({ skill: node.id, missing });
    }
  }
  return { ok: errors.length === 0, order, errors };
}

export function recordExecutedGraph(taskId, graph, executedOrder, root) {
  const dir = path.join(root, ".wam", "tasks", taskId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "skill-graph.json");
  const payload = {
    taskId,
    executedOrder: executedOrder.slice(),
    nodes: graph.nodes,
    edges: graph.edges,
    recordedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

export function getExecutedGraph(taskId, root) {
  const file = path.join(root, ".wam", "tasks", taskId, "skill-graph.json");
  try {
    const text = fs.readFileSync(file, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function planExecution(graph, produced = []) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const producedSet = new Set(produced);
  const errors = [];
  for (const node of graph.nodes) {
    const missing = (node.requires || []).filter((r) => !ids.has(r) && !producedSet.has(r));
    if (missing.length) errors.push({ skill: node.id, missing });
  }
  let order;
  try {
    order = topoSort(graph);
  } catch (err) {
    return { ok: false, order: [], errors: [...errors, { skill: "*", missing: [], reason: err.message }], steps: [] };
  }
  const outputsBySkill = new Map(graph.nodes.map((n) => [n.id, n.outputs || []]));
  const steps = order.map((id) => {
    const node = graph.nodes.find((n) => n.id === id);
    const receives = [];
    for (const dep of node?.requires || []) {
      for (const art of outputsBySkill.get(dep) || []) {
        receives.push({ artifact: art, from: dep });
      }
    }
    return { skill: id, receives, produces: node?.outputs || [] };
  });
  return { ok: errors.length === 0, order, errors, steps };
}

export function preserveStateAcrossTransition(state, { executedSkill = null, produced = [] } = {}) {
  const base = state && typeof state === "object" ? state : {};
  const trail = Array.isArray(base.skillTrail) ? base.skillTrail : [];
  return {
    ...base,
    contract: base.contract ?? null,
    requirements: base.requirements ?? [],
    claims: base.claims ?? [],
    skillTrail: executedSkill
      ? [...trail, { skill: executedSkill, produced: [...produced], at: new Date().toISOString() }]
      : trail,
  };
}
