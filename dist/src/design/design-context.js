/**
 * Design Context Persistence & Token Management — `DESIGN.md` discovery, parsing, init, set, drift.
 */

import fs from "node:fs";
import path from "node:path";

export function getDesignPath(root = process.cwd()) {
  return path.join(root, "DESIGN.md");
}

export function loadDesignContext(root = process.cwd()) {
  const filePath = getDesignPath(root);
  if (!fs.existsSync(filePath)) {
    return { exists: false, tokens: {}, raw: "" };
  }
  const content = fs.readFileSync(filePath, "utf8");
  const tokens = parseDesignTokens(content);
  return { exists: true, tokens, raw: content };
}

export function parseDesignTokens(content = "") {
  const match = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

export function initDesignContext(root = process.cwd(), templateContent = "") {
  const filePath = getDesignPath(root);
  if (fs.existsSync(filePath)) {
    return { success: false, error: "DESIGN.md already exists" };
  }
  const templatePath = path.join(root, "templates", "DESIGN.md");
  let content = templateContent;
  if (!content && fs.existsSync(templatePath)) {
    content = fs.readFileSync(templatePath, "utf8");
  }
  if (!content) {
    content = `# Project Design System & Identity (\`DESIGN.md\`)\n\n## Semantic Tokens\n\n\`\`\`json\n{\n  "color": { "action": { "primary": "#2563EB" } },\n  "radius": { "control": "6px" }\n}\n\`\`\`\n`;
  }
  fs.writeFileSync(filePath, content, "utf8");
  return { success: true, filePath };
}

export function setDesignToken(root = process.cwd(), tokenPath = "", value = "") {
  const ctx = loadDesignContext(root);
  if (!ctx.exists) {
    initDesignContext(root);
  }
  const currentCtx = loadDesignContext(root);
  const tokens = currentCtx.tokens;
  
  // Set dot notation path like color.action.primary
  const parts = tokenPath.split(".");
  let obj = tokens;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]]) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;

  // Update JSON block in DESIGN.md
  let content = currentCtx.raw || `# DESIGN.md\n\n## Semantic Tokens\n\n\`\`\`json\n{}\n\`\`\`\n`;
  const jsonStr = JSON.stringify(tokens, null, 2);
  if (/```json\s*[\s\S]*?\s*```/.test(content)) {
    content = content.replace(/```json\s*[\s\S]*?\s*```/, `\`\`\`json\n${jsonStr}\n\`\`\``);
  } else {
    content += `\n## Semantic Tokens\n\n\`\`\`json\n${jsonStr}\n\`\`\`\n`;
  }
  fs.writeFileSync(getDesignPath(root), content, "utf8");
  return { success: true, tokens };
}

export function detectDesignDrift(root = process.cwd(), implementationValues = {}) {
  const ctx = loadDesignContext(root);
  if (!ctx.exists) return { drift: false, violations: [] };
  const tokens = ctx.tokens;
  const violations = [];

  // Check radius drift e.g. DESIGN.md radius.control 8px vs implementation 14px
  const expectedRadius = tokens?.radius?.control;
  if (expectedRadius && implementationValues.radius && implementationValues.radius !== expectedRadius) {
    violations.push({
      token: "radius.control",
      expected: expectedRadius,
      actual: implementationValues.radius,
      message: `Drift detected: DESIGN.md specifies radius.control=${expectedRadius}, but implementation uses ${implementationValues.radius}`
    });
  }

  return { drift: violations.length > 0, violations };
}
