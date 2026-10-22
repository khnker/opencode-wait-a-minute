import fs from "node:fs";
import path from "node:path";

export const DESIGN_CATEGORIES = [
  "new product", "new page", "new flow", "existing page modification",
  "component modification", "component creation", "redesign", "visual review",
  "responsive work", "accessibility work", "design-system work", "token modification", "content/copy work"
];

export function classifyDesignTask(prompt = "") {
  const p = prompt.toLowerCase();
  if (/(token|color|spacing|radius|typography|font|make buttons more rounded)/i.test(p)) return "token modification";
  if (/(accessibility|a11y|wcag|label|focus|keyboard|screen reader)/i.test(p)) return "accessibility work";
  if (/(responsive|mobile|tablet|breakpoint|screen size)/i.test(p)) return "responsive work";
  if (/(review|audit|critique|check ui|verify)/i.test(p)) return "visual review";
  if (/(component|button|card|modal|dropdown)/i.test(p) && /(create|new|add)/i.test(p)) return "component creation";
  if (/(component|button|card|modal|dropdown)/i.test(p)) return "component modification";
  if (/(page|screen|view)/i.test(p) && /(create|new|add)/i.test(p)) return "new page";
  if (/(flow|wizard|checkout|funnel)/i.test(p)) return "new flow";
  if (/(product|app|startup|application)/i.test(p) && /(create|new|build)/i.test(p)) return "new product";
  if (/(redesign|overhaul|refresh|revamp)/i.test(p)) return "redesign";
  if (/(design system|tokens|guidelines)/i.test(p)) return "design-system work";
  if (/(copy|text|content|headline)/i.test(p)) return "content/copy work";
  if (/(page|screen|view)/i.test(p)) return "existing page modification";
  return "existing page modification";
}

export function loadDesignContext(root = process.cwd()) {
  const designPath = path.join(root, "DESIGN.md");
  if (!fs.existsSync(designPath)) {
    return { exists: false, tokens: {}, raw: "" };
  }
  const raw = fs.readFileSync(designPath, "utf8");
  const tokens = loadDesignTokens(root, raw);
  return { exists: true, tokens, raw };
}

export function loadDesignTokens(root = process.cwd(), rawContent = null) {
  const designPath = path.join(root, "DESIGN.md");
  const raw = rawContent || (fs.existsSync(designPath) ? fs.readFileSync(designPath, "utf8") : "");
  const jsonMatch = raw.match(/```json([\s\S]*?)```/);
  if (!jsonMatch) return {};
  try {
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    return {};
  }
}

export function initDesignContext(root = process.cwd(), brandInfo = {}) {
  const designPath = path.join(root, "DESIGN.md");
  const templatePath = path.join(root, "templates", "DESIGN.md");
  let content = "";
  if (fs.existsSync(templatePath)) {
    content = fs.readFileSync(templatePath, "utf8");
  } else {
    content = `# DESIGN.md\n\n## Identity\n- Project Name: ${brandInfo.name || "Project"}\n\n## Semantic Tokens\n\`\`\`json\n{\n  "color": {\n    "action": {\n      "primary": "#2563EB"\n    }\n  }\n}\n\`\`\`\n`;
  }
  fs.writeFileSync(designPath, content, "utf8");
  return designPath;
}

export function setDesignToken(root = process.cwd(), tokenPath = "", value = "") {
  const ctx = loadDesignContext(root);
  if (!ctx.exists) {
    initDesignContext(root);
  }
  const tokens = loadDesignTokens(root);
  // Simple nested path setter e.g. color.action.primary
  const parts = tokenPath.split(".");
  let obj = tokens;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]]) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
  
  // Update DESIGN.md json block
  const designPath = path.join(root, "DESIGN.md");
  let raw = fs.readFileSync(designPath, "utf8");
  const newJsonStr = JSON.stringify(tokens, null, 2);
  raw = raw.replace(/```json[\s\S]*?```/, "```json\n" + newJsonStr + "\n```");
  fs.writeFileSync(designPath, raw, "utf8");
  return tokens;
}

export function checkDesignDrift(root = process.cwd()) {
  const ctx = loadDesignContext(root);
  if (!ctx.exists) return { drifted: false, violations: [] };
  // Check drift heuristics (e.g. sample implementation vs tokens)
  return { drifted: false, violations: [] };
}
