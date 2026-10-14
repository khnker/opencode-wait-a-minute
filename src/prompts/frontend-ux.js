import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { loadPrompt } from "./loader.js";

const MANIFEST_PATH = fileURLToPath(
  new URL("../../prompts/frontend-ux/manifest.json", import.meta.url),
);

let manifestCache = null;

/**
 * Read the frontend-ux suite manifest. The manifest is the suite's own
 * catalog of prompt ids/versions/contracts; it complements (never replaces)
 * `prompts/index.json`.
 */
export function loadFrontendUxManifest() {
  if (manifestCache) return manifestCache;
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  manifestCache = JSON.parse(raw);
  return manifestCache;
}

/** Stable ids of the frontend-ux prompts, in suite order. */
export const FRONTEND_UX_PROMPT_IDS = Object.freeze([
  "frontend-ux-diagnose",
  "frontend-ux-design",
  "frontend-ux-refine",
  "frontend-ux-verify",
  "frontend-ux-review",
]);

/**
 * Load a frontend-ux prompt through the shared WAM prompt loader. Activation
 * gating (frontend-only tasks) is the caller's responsibility; this adapter
 * only resolves ids to the central catalog.
 */
export function loadFrontendUxPrompt(id, vars = {}) {
  switch (id) {
    case "frontend-ux-diagnose":
      return loadPrompt("frontend-ux-diagnose", vars);
    case "frontend-ux-design":
      return loadPrompt("frontend-ux-design", vars);
    case "frontend-ux-refine":
      return loadPrompt("frontend-ux-refine", vars);
    case "frontend-ux-verify":
      return loadPrompt("frontend-ux-verify", vars);
    case "frontend-ux-review":
      return loadPrompt("frontend-ux-review", vars);
    default:
      throw new Error(`frontend-ux: unknown prompt id "${id}"`);
  }
}
