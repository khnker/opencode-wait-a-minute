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

test('cqe-first: hook por defecto (sin env) avisa sin bloquear', async () => {
  const orig = process.env.WAM_READ_DELEGATION;
  delete process.env.WAM_READ_DELEGATION;
  try {
    const hooks = await getHooks();
    const input = { tool: "bash", sessionID: "cqe-first-main", callID: "c1" };
    const output = { args: { command: "grep -rn foo src" } };
    await hooks["tool.execute.before"](input, output);
    assert.ok(input.output && String(input.output).includes("/wam ctx get"), "warn por defecto debe setear input.output con nudge CQE-first");
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});

test('cqe-first: hook con off silencia, con enforce bloquea', async () => {
  const orig = process.env.WAM_READ_DELEGATION;
  try {
    const hooks = await getHooks();
    process.env.WAM_READ_DELEGATION = "off";
    const inputOff = { tool: "bash", sessionID: "cqe-first-main", callID: "c2" };
    await hooks["tool.execute.before"](inputOff, { args: { command: "grep -rn foo src" } });
    assert.equal(inputOff.output ?? null, null);

    process.env.WAM_READ_DELEGATION = "enforce";
    await assert.rejects(
      hooks["tool.execute.before"](
        { tool: "bash", sessionID: "cqe-first-main", callID: "c3" },
        { args: { command: "grep -rn foo src" } },
      ),
    );
  } finally {
    if (orig !== undefined) process.env.WAM_READ_DELEGATION = orig;
    else delete process.env.WAM_READ_DELEGATION;
  }
});
