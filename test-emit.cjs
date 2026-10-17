const WaitAMinutePlugin = require('./index.js').default; 

(async () => {
  const tmpDir = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'wam-test-'));
  const plugin = await WaitAMinutePlugin({ directory: tmpDir, debug: true });
  const sessionID = "test-session";
  const input = {
    sessionID,
    messageID: "msg-test",
    message: {
      parts: [
        { type: "text", text: "Hola mundo" }
      ]
    }
  };
  const output = { message: { id: "out-test", parts: [] } };
  await plugin["chat.message"](input, output);
  console.log("Emitted parts:", output.message.parts.map(p => p.text));
})();