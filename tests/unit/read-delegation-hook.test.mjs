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
    { name: 'enforce + MAIN + read → throw', mode: 'enforce', sessionID: 'rd-main', tool: 'read', args: { filePath: 'x' }, shouldThrow: true },
    { name: 'enforce + SUBAGENT + read → no throw', mode: 'enforce', sessionID: 'rd-sub', tool: 'read', args: { filePath: 'x' }, shouldThrow: false },
    { name: 'enforce + MAIN + write → no throw', mode: 'enforce', sessionID: 'rd-main', tool: 'write', args: { filePath: 'x' }, shouldThrow: false },
    { name: 'warn + MAIN + read → no throw', mode: 'warn', sessionID: 'rd-main', tool: 'read', args: { filePath: 'x' }, shouldThrow: false },
    { name: 'off + MAIN + read → no throw', mode: 'off', sessionID: 'rd-main', tool: 'read', args: { filePath: 'x' }, shouldThrow: false },
    { name: 'enforce + MAIN + grep → throw', mode: 'enforce', sessionID: 'rd-main', tool: 'grep', args: { pattern: 'x' }, shouldThrow: true },
  ];

  for (const sc of scenarios) {
    await t.test(sc.name, async () => {
      process.env.WAM_READ_DELEGATION = sc.mode;
      await setupSession(hooks, sc.sessionID);
      
      if (sc.shouldThrow) {
        await assert.rejects(
          async () => await hooks["tool.execute.before"]({ sessionID: sc.sessionID, tool: sc.tool, args: sc.args }, { args: sc.args })
          // Assuming the WamPolicyBlock message contains the directive, which should contain "READ DELEGATION" or similar.
          // Let's just verify it throws.
        );
      } else {
        await assert.doesNotReject(
          async () => await hooks["tool.execute.before"]({ sessionID: sc.sessionID, tool: sc.tool, args: sc.args }, { args: sc.args })
        );
      }
    });
  }
});
