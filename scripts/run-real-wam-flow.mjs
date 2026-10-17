/**
 * Real WAM Flow Execution Runner
 * Simulates a real user prompt through the actual WAM message handler
 * and outputs state transitions, evidence, token savings, and CQE telemetry.
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import WaitAMinutePlugin from "../index.js";

async function runRealFlow() {
  console.log("=== Starting Real Multi-Turn WAM Flow Execution ===");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-real-flow-"));
  console.log(`[1] Created temp workspace: ${tmpDir}`);

  const plugin = await WaitAMinutePlugin({ directory: tmpDir, debug: true });
  const sessionID = "real-session-999";

  // Turn 1: Propose task
  const input1 = {
    sessionID,
    messageID: "msg-001",
    message: {
      parts: [
        { type: "text", text: "Implementar un nuevo endpoint de autenticacion OAuth2 con validacion de tokens." }
      ]
    }
  };
  const output1 = { message: { id: "out-001", parts: [] } };
  console.log("\n[Turn 1] Sending prompt: 'Implementar un nuevo endpoint...'");
  await plugin["chat.message"](input1, output1);
  console.log("-> Injected parts:");
  for (const [i, part] of output1.message.parts.entries()) {
    console.log(`   Part ${i}:`);
    console.log(`     type: ${part.type}`);
    console.log(`     text: ${part.text?.slice(0, 200)}`);
    if (part.sessionID) console.log(`     sessionID: ${part.sessionID}`);
    if (part.messageID) console.log(`     messageID: ${part.messageID}`);
  }

  // Turn 2: Approve contract
  const input2 = {
    sessionID,
    messageID: "msg-002",
    message: {
      parts: [
        { type: "text", text: "Sí, aprobado, dale adelante" }
      ]
    }
  };
  const output2 = { message: { id: "out-002", parts: [] } };
  console.log("\n[Turn 2] Sending approval: 'Sí, aprobado, dale adelante'");
  await plugin["chat.message"](input2, output2);
  console.log("-> Injected parts:");
  for (const [i, part] of output2.message.parts.entries()) {
    console.log(`   Part ${i}:`);
    console.log(`     type: ${part.type}`);
    console.log(`     text: ${part.text?.slice(0, 200)}`);
    if (part.sessionID) console.log(`     sessionID: ${part.sessionID}`);
    if (part.messageID) console.log(`     messageID: ${part.messageID}`);
  }

  // Turn 3: Complete task
  const input3 = {
    sessionID,
    messageID: "msg-003",
    message: {
      parts: [
        { type: "text", text: "Listo, todo implementado y verificado con éxito" }
      ]
    }
  };
  const output3 = { message: { id: "out-003", parts: [] } };
  console.log("\n[Turn 3] Sending completion: 'Listo, todo implementado y verificado con éxito'");
  await plugin["chat.message"](input3, output3);
  console.log("-> Injected parts:");
  for (const [i, part] of output3.message.parts.entries()) {
    console.log(`   Part ${i}:`);
    console.log(`     type: ${part.type}`);
    console.log(`     text: ${part.text?.slice(0, 200)}`);
    if (part.sessionID) console.log(`     sessionID: ${part.sessionID}`);
    if (part.messageID) console.log(`     messageID: ${part.messageID}`);
  }

  const wamRoot = path.join(tmpDir, ".wam");
  console.log(`\n[4] Final WAM State under ${wamRoot}:`);
  if (fs.existsSync(wamRoot)) {
    const allFiles = fs.readdirSync(wamRoot, { recursive: true });
    console.log(`- Files under .wam:`, allFiles.filter(f => !f.includes(".gitkeep")));
  }

  console.log("=== Real Multi-Turn WAM Flow Execution Complete ===");
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

runRealFlow().catch(console.error);
