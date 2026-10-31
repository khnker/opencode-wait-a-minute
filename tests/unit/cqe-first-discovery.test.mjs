import { test } from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import pluginDefault from "../../index.js";
import { evaluateDiscovery } from "../../src/policy/discovery-classifier.js";

const CWD = process.cwd();
const mockClient = { session: { get: async ({ sessionID }) => ({ location: { directory: CWD } }) } };

async function getHooks() {
  return await pluginDefault({ directory: CWD, client: mockClient, project: {}, $: {} });
}

test('cqe-first: classifier redirige búsquedas shell a CQE', () => {
  for (const cmd of ["grep -rn foo src", "find . -name '*.js'", "ls -la src", "rg pattern"]) {
    const r = evaluateDiscovery("bash", { command: cmd });
    assert.ok(r?.nudge, `esperaba nudge para: ${cmd}`);
    assert.ok(r.nudge.includes("/wam ctx get"), `nudge debe apuntar a CQE: ${cmd}`);
  }
});

test('cqe-first: xargs grep es búsqueda (read-only), xargs rm no', () => {
  const search = evaluateDiscovery("bash", { command: 'find . -name "*.js" | xargs grep -l "skill\\|Skill" | head -10' });
  assert.ok(search?.nudge?.includes("/wam ctx get"));
  assert.equal(evaluateDiscovery("bash", { command: "find . -name '*.js' | xargs rm" })?.nudge ?? null, null);
});

test('cqe-first: comandos no-búsqueda no generan nudge', () => {
  assert.equal(evaluateDiscovery("bash", { command: "npm test" })?.nudge ?? null, null);
  assert.equal(evaluateDiscovery("read", {})?.nudge ?? null, null);
});

test('cqe-first: find con predicados/exec que escriben no es discovery', () => {
  for (const cmd of [
    "find . -delete",
    "find . -name '*.log' -fprint out.txt",
    "find . -exec sh -c 'echo hi > f' \\;",
    "find . -ok rm {} \\;",
  ]) {
    assert.equal(evaluateDiscovery("bash", { command: cmd })?.nudge ?? null, null, `no debía nudger: ${cmd}`);
  }
  // control: -exec con programa read-only sigue siendo búsqueda
  const control = evaluateDiscovery("bash", { command: "find . -exec grep -l foo {} +" });
  assert.ok(control?.nudge?.includes("/wam ctx get"), "find -exec grep debe seguir nudgeando");
});

test('cqe-first: flags de escritura de sed/sort/awk/rg no son discovery', () => {
  for (const cmd of [
    "cat x | sed -i 's/a/b/' f",
    "cat x | sort -o out.txt",
    "awk '{print > \"f\"}' x",
    "rg --pre 'sh -c x' pattern",
  ]) {
    assert.equal(evaluateDiscovery("bash", { command: cmd })?.nudge ?? null, null, `no debía nudger: ${cmd}`);
  }
  // control: awk en pipeline solo imprime a stdout y sigue siendo read-only
  const control = evaluateDiscovery("bash", { command: "cat x | awk '{print $1}'" });
  assert.ok(control?.nudge, "awk de solo impresión en pipeline debe seguir nudgeando");
  // control: awk como comando principal no es herramienta de discovery (justified)
  assert.equal(evaluateDiscovery("bash", { command: "awk '{print $1}' x" })?.nudge ?? null, null, "awk primario debe quedar justified");
});

test('cqe-first: flags mutantes entre comillas no son discovery', () => {
  for (const cmd of [
    'find . "-delete"',
    'cat x | sed "-i" \'s/a/b/\' f',
    'cat x | sort "-o" out.txt',
    'rg "--pre" \'sh -c x\' pattern',
    'find . -exec "sh" -c x \\;',
  ]) {
    assert.equal(evaluateDiscovery("bash", { command: cmd })?.nudge ?? null, null, `no debía nudger: ${cmd}`);
  }
  // control: comillas en patrones/prints normales no rompen el nudge
  for (const cmd of ['find . -name \'*.js\' "-print"', 'grep "-rn" foo src']) {
    assert.ok(evaluateDiscovery("bash", { command: cmd })?.nudge, `debía nudger: ${cmd}`);
  }
});

test('cqe-first: hook por defecto (sin env) avisa sin bloquear', async () => {
  const orig = process.env.WAM_READ_DELEGATION;
  delete process.env.WAM_READ_DELEGATION;
  try {
    const hooks = await getHooks();
    const input = { tool: "bash", sessionID: "cqe-first-main", callID: "c1" };
    await hooks["tool.execute.before"](input, { args: { command: "grep -rn foo src" } });
    assert.equal(input.output, undefined, "before no puede escribir input.output (contrato real)");

    const result = { title: "r", output: "tool result text", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c1" }, result);
    assert.ok(String(result.output).includes("tool result text"), "el resultado original se conserva");
    assert.ok(String(result.output).includes("/wam ctx get"), "after debe entregar el nudge CQE-first");

    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c1" }, result);
    assert.equal(String(result.output).split("/wam ctx get").length - 1, 1, "la directiva se entrega una sola vez (cola drenada)");
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test('cqe-first: hook con off silencia, con enforce avisa sin bloquear', async () => {
  const orig = process.env.WAM_READ_DELEGATION;
  try {
    const hooks = await getHooks();
    process.env.WAM_READ_DELEGATION = "off";
    const inputOff = { tool: "bash", sessionID: "cqe-first-main", callID: "c2" };
    await hooks["tool.execute.before"](inputOff, { args: { command: "grep -rn foo src" } });
    assert.equal(inputOff.output ?? null, null);
    const resultOff = { title: "r", output: "tool result text", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c2" }, resultOff);
    assert.equal(resultOff.output, "tool result text", "off no encola directiva: el resultado queda byte-idéntico");

    process.env.WAM_READ_DELEGATION = "enforce";
    await assert.doesNotReject(
      hooks["tool.execute.before"](
        { tool: "bash", sessionID: "cqe-first-main", callID: "c3" },
        { args: { command: "grep -rn foo src" } },
      ),
      "enforce es advisory: nunca lanza",
    );
    const resultEnforce = { title: "r", output: "tool result text", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c3" }, resultEnforce);
    assert.ok(String(resultEnforce.output).includes("tool result text"), "el resultado original se conserva");
    assert.match(String(resultEnforce.output), /Prefer|CQE|deleg/i, "enforce agrega nudge advisory");
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test('cqe-first: dos callIDs distintos reciben su propia directiva sin pisarse', async () => {
  const orig = process.env.WAM_READ_DELEGATION;
  delete process.env.WAM_READ_DELEGATION;
  try {
    const hooks = await getHooks();
    for (const callID of ["c-a", "c-b"]) {
      await hooks["tool.execute.before"](
        { tool: "bash", sessionID: "cqe-first-main", callID },
        { args: { command: "grep -rn foo src" } },
      );
    }
    const a = { title: "r", output: "out-a", metadata: {} };
    const b = { title: "r", output: "out-b", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c-a" }, a);
    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c-b" }, b);
    assert.ok(a.output.includes("out-a") && a.output.includes("/wam ctx get"));
    assert.ok(b.output.includes("out-b") && b.output.includes("/wam ctx get"));
    assert.equal(a.output.split("/wam ctx get").length - 1, 1, "c-a recibe una sola directiva");
    assert.equal(b.output.split("/wam ctx get").length - 1, 1, "c-b recibe una sola directiva");
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test('cqe-first: dos directivas del mismo callID se concatenan (ninguna se pierde)', async () => {
  const orig = process.env.WAM_READ_DELEGATION;
  delete process.env.WAM_READ_DELEGATION;
  try {
    // Seam observable: el hook before encola por callID. Dos entradas para el
    // mismo callID demuestran que la segunda concatena en vez de reemplazar.
    const hooks = await getHooks();
    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "cqe-first-main", callID: "c-merged" },
      { args: { command: "grep -rn foo src" } },
    );
    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "cqe-first-main", callID: "c-merged" },
      { args: { command: "ls -la src" } },
    );
    const merged = { title: "r", output: "tool result text", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c-merged" }, merged);

    assert.equal(merged.output.split("/wam ctx get").length - 1, 2, "ambas directivas se conservan");
    assert.ok(merged.output.includes("tool result text"), "el resultado original se conserva");
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test('cqe-first: output vacío recibe la directiva; output no-string no se coacciona', async () => {
  const orig = process.env.WAM_READ_DELEGATION;
  delete process.env.WAM_READ_DELEGATION;
  try {
    const hooks = await getHooks();

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "cqe-first-main", callID: "c-empty" },
      { args: { command: "grep -rn foo src" } },
    );
    const empty = { title: "r", output: "", metadata: {} };
    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c-empty" }, empty);
    assert.ok(empty.output.includes("/wam ctx get"), "output vacío recibe la directiva");
    assert.equal(empty.output, empty.output.trim(), "no quedan separadores sobrantes");

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "cqe-first-main", callID: "c-zero" },
      { args: { command: "grep -rn foo src" } },
    );
    const zero = { title: "r", output: 0, metadata: {} };
    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c-zero" }, zero);
    assert.equal(zero.output, 0, "output numérico no se coacciona a string");

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "cqe-first-main", callID: "c-object" },
      { args: { command: "grep -rn foo src" } },
    );
    const obj = { title: "r", output: { keep: true }, metadata: {} };
    await hooks["tool.execute.after"]({ tool: "bash", sessionID: "cqe-first-main", callID: "c-object" }, obj);
    assert.deepEqual(obj.output, { keep: true }, "output objeto queda intacto");
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});
