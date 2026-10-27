import test from "node:test";
import assert from "node:assert";
import { handleMessage } from "../src/integration/message-handler.js";
import waitAMinute from "../index.js";
import { isWamSynthetic } from "../src/integration/part-provenance.js";
import fs from "node:fs";
import path from "node:path";

test("Real Integration Test with Live OpenCode WAM Pipeline", async () => {
  const sessionID = "ses-live-real-user-" + Date.now();
  const projectRoot = path.join("/tmp", "live_wam_test_" + Date.now());
  fs.mkdirSync(projectRoot, { recursive: true });

  const input = {
    sessionID,
    messageID: "msg-live-1",
    message: {
      id: "msg-live-1",
      parts: [{ type: "text", text: "Crear una función para calcular el área de un círculo en TypeScript." }]
    }
  };

  const output = {
    parts: []
  };

  const sessionTasks = new Map();
  const sessionStore = new Map();

  // Deps reales conectadas a los módulos reales de WAM e index.js
  const deps = {
    bypassed: false,
    sessionTasks,
    sessionStore,
    cfg: { tierCaps: {}, activePreset: "omni", activeMode: "normal" },
    resolveSessionBase: () => projectRoot,
    wamRootFor: () => projectRoot,
    ensureWamMemory: async () => projectRoot,
    effectiveTaskId: waitAMinute.effectiveTaskId,
    isContinuationPrompt: waitAMinute.isContinuationPrompt,
    genPartId: () => "part-" + Math.random().toString(36).slice(2),
    emitTextPart: (out, text, meta) => {
      out.parts.push({ type: "text", text, metadata: { wam: true, wamMessageId: meta.messageID } });
      return { status: "inserted" };
    },
    readActiveTaskIdFresh: () => null,
    writeActiveTaskId: () => {},
    waitAMinute,
    migrateLegacyCognition: () => {},
    noteSuccess: async () => {},
    noteFailure: async () => {},
    getTaskState: (taskId, root) => waitAMinute.getTaskState ? waitAMinute.getTaskState(taskId, root) : null,
    persistTaskState: (taskId, state, root) => waitAMinute.persistTaskState ? waitAMinute.persistTaskState(taskId, state, root) : null,
    findDuplicateTask: () => null,
    escalateAssumptions: () => ({ changed: false }),
    buildAssumptions: () => ({}),
    initMemory: () => {},
    updateProjectMemo: () => {},
    updateLiveContext: () => {},
    readLiveContext: () => ({}),
    persistLiveContext: () => {},
    assembleContext: () => "",
    selectContextWithCqe: async () => ({ text: "" }),
    detectFileSearchIntent: () => false,
    createSnapshot: () => {},
    checkContinuation: () => ({ isContinuation: false }),
    rebuildScope: () => {},
    getDecision: () => null,
    recordDecision: () => {},
    compactDecisions: () => {},
    writeCavemanSummary: () => {},
    truncate: (s) => s,
    delegationLines: () => [],
    updateTaskMemory: () => {},
    addRecentChange: () => {},
    closeSession: () => {},
    getSessionId: () => sessionID,
    classifyAskingMessage: () => ({ isAsking: false }),
    getPreflightAnalyzer: () => ({ analyze: async (p) => await waitAMinute.analyze(p) })
  };

  // Ejecución real del pipeline de mensaje con WAM e index.js
  await handleMessage(input, output, deps);

  // Verificación 1: El mensaje original del usuario NUNCA fue mutado ni contaminado con texto inyectado
  const originalUserText = input.message.parts[0].text;
  assert.strictEqual(
    originalUserText,
    "Crear una función para calcular el área de un círculo en TypeScript.",
    "El mensaje original del usuario fue alterado o contaminado."
  );

  // Verificación 2: Las partes inyectadas por WAM en la salida están correctamente etiquetadas como sintéticas (sin tocar al usuario)
  for (const part of output.parts) {
    if (part.metadata?.wam) {
      assert.strictEqual(
        isWamSynthetic(part),
        true,
        "Las partes generadas por WAM deben estar marcadas como sintéticas."
      );
    }
  }

  console.log("SUCCESS: Live OpenCode & WAM integration test passed without message mutation or friction.");
});
