import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-turn-timing-"));
const logFile = path.join(tmpDir, "plugin.log");
process.env.WAM_LOG_FILE = logFile;
process.env.WAM_LOGGING = "true";

test("handleMessage writes turn-timing phases", async () => {
  try {
    const { configureLogger } = await import("../../src/integration/logger.js");
    configureLogger({ enabled: true });
    const { handleMessage } = await import("../../src/integration/message-handler.js");

    const wamRoot = fs.mkdtempSync(path.join(tmpDir, "root-"));
    const deps = {
      cfg: {},
      sessionTasks: new Map(),
      sessionStore: new Map(),
      ensureWamMemory: async () => wamRoot,
      effectiveTaskId: (input) => ({
        taskId: input.taskId || "t-timing",
        fallbackKind: "explicit",
      }),
      readActiveTaskIdFresh: () => null,
      isContinuationPrompt: () => false,
      getTaskState: () => null,
      emitTextPart: () => {},
    };

    await handleMessage(
      {
        sessionID: "sess-timing",
        taskId: "t-timing",
        parts: [{ type: "text", text: "implementar endpoint" }],
      },
      { parts: [], message: { id: "m-timing" } },
      deps,
    );

    const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "";
    const lines = log
      .split("\n")
      .filter((line) => line.includes("[turn-timing]") && line.includes("phase="));

    assert.ok(lines.length > 0, `expected turn-timing lines, got:\n${log}`);
    assert.ok(
      lines.some((line) => line.includes("phase=resolveTask")),
      `missing resolveTask phase:\n${lines.join("\n")}`,
    );
    assert.ok(
      lines.some((line) => line.includes("phase=loadTaskState")),
      `missing loadTaskState phase:\n${lines.join("\n")}`,
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
