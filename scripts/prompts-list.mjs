import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const promptsRoot = path.resolve(fileURLToPath(new URL("../prompts/", import.meta.url)));
const indexPath = path.join(promptsRoot, "index.json");

let catalog;
try {
  catalog = JSON.parse(fs.readFileSync(indexPath, "utf8"));
} catch (e) {
  console.error(`prompts:list: cannot read index.json: ${e.message}`);
  process.exit(1);
}

const entries = Array.isArray(catalog)
  ? catalog
  : catalog && Array.isArray(catalog.prompts)
    ? catalog.prompts
    : null;

if (!entries) {
  console.error("prompts:list: index.json must be an array of prompt entries");
  process.exit(1);
}

for (const entry of entries) {
  const consumers = Array.isArray(entry.consumers) ? entry.consumers.join(", ") : "";
  console.log(`${entry.id} | ${entry.status} | ${consumers}`);
}
