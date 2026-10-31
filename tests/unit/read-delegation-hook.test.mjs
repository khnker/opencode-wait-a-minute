import { test } from 'node:test';
import assert from 'node:assert/strict';
import pluginDefault from "../../index.js";
import process from 'node:process';

const CWD = process.cwd();
const mockClient = { session: { get: async ({ sessionID }) =>
  sessionID === "rd-sub" ? { parentID: "rd-main", location: { directory: CWD } }
                         : { location: { directory: CWD } } } };

async function getHooks() {
  return await pluginDefault({ directory: CWD, client: mockClient, project: {}, $: {} });
}

async function setupSession(hooks, sessionID) {
  await hooks["chat.message"]({ sessionID, messageID: `${sessionID}-1`, message: { parts: [{ type: "text", text: "hi" }] } }, { message:{}, parts:[] });
}

test('read-delegation-hook', async (t) => {
  const hooks = await getHooks();
  
  const scenarios = [
    { name: 'enforce + MAIN + read → advisory directive, no throw', mode: 'enforce', sessionID: 'rd-main', tool: 'read', args: { filePath: 'x' }, expectDirective: true },
    { name: 'enforce + SUBAGENT + read → no throw', mode: 'enforce', sessionID: 'rd-sub', tool: 'read', args: { filePath: 'x' }, expectDirective: false },
    { name: 'enforce + MAIN + write → no throw', mode: 'enforce', sessionID: 'rd-main', tool: 'write', args: { filePath: 'x' }, expectDirective: false },
    { name: 'warn + MAIN + read → advisory directive, no throw', mode: 'warn', sessionID: 'rd-main', tool: 'read', args: { filePath: 'x' }, expectDirective: true },
    { name: 'off + MAIN + read → no throw', mode: 'off', sessionID: 'rd-main', tool: 'read', args: { filePath: 'x' }, expectDirective: false },
    { name: 'enforce + MAIN + grep → advisory directive, no throw', mode: 'enforce', sessionID: 'rd-main', tool: 'grep', args: { pattern: 'x' }, expectDirective: true },
  ];

  for (const sc of scenarios) {
    await t.test(sc.name, async () => {
      process.env.WAM_READ_DELEGATION = sc.mode;
      await setupSession(hooks, sc.sessionID);
      const callID = `call-${sc.name}`;
      const input = { sessionID: sc.sessionID, callID, tool: sc.tool, args: sc.args };

      // Zero friction: the delegation gate never blocks tool execution.
      await assert.doesNotReject(
        async () => await hooks["tool.execute.before"](input, { args: sc.args })
      );

      // Advisory enforcement surfaces as a directive appended to the result.
      const output = { output: "ok" };
      await hooks["tool.execute.after"](input, output);
      if (sc.expectDirective) {
        assert.match(output.output, /READ DELEGATION/, "la recomendación viaja como directiva advisory");
      } else {
        assert.equal(output.output, "ok", "sin directiva de delegación");
      }
    });
  }
});
