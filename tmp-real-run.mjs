import WaitAMinutePlugin from './index.js';
import fs from 'node:fs';
import path from 'node:path';

async function runRealTest() {
  console.log("=== WAM Real End-to-End Run Simulation ===");
  const root = path.join(process.cwd(), 'test_tmp_wam');
  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  fs.mkdirSync(root, { recursive: true });

  const plugin = WaitAMinutePlugin();
  const sessionID = "ses-real-test-123";
  const output = { message: { id: "msg-1" }, parts: [] };

  console.log("\n[Turn 1] User sends natural prompt: 'Implementar autenticación JWT en la API'");
  await plugin["chat.message"]({
    sessionID,
    messageID: "msg-1",
    text: "Implementar autenticación JWT en la API",
  }, output);

  console.log("-> WAM Output injected parts:", output.parts.length);
  output.parts.forEach((p, i) => console.log(`   Part ${i}:`, p.text?.slice(0, 150)));

  console.log("\n[Turn 2] User sends approval: 'Sí, aprobado, dale adelante'");
  const output2 = { message: { id: "msg-2" }, parts: [] };
  await plugin["chat.message"]({
    sessionID,
    messageID: "msg-2",
    text: "Sí, aprobado, dale adelante",
  }, output2);

  console.log("-> WAM Output injected parts:", output2.parts.length);
  output2.parts.forEach((p, i) => console.log(`   Part ${i}:`, p.text?.slice(0, 150)));

  console.log("\n[Turn 3] User claims completion: 'Listo, todo implementado y verificado con éxito'");
  const output3 = { message: { id: "msg-3" }, parts: [] };
  await plugin["chat.message"]({
    sessionID,
    messageID: "msg-3",
    text: "Listo, todo implementado y verificado con éxito",
  }, output3);

  console.log("-> WAM Output injected parts:", output3.parts.length);
  output3.parts.forEach((p, i) => console.log(`   Part ${i}:`, p.text?.slice(0, 150)));

  console.log("\n=== Simulation Complete ===");
  fs.rmSync(root, { recursive: true, force: true });
}

runRealTest().catch(console.error);
