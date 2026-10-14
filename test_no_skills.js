import { analyze } from "./src/skills/engine.js";

async function test() {
  try {
    const result = await analyze({ 
      prompt: "hola mundo", 
      projectPath: ".", 
      config: { skills: false } 
    });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Error:", e);
    console.error(e.stack);
  }
}
test();
