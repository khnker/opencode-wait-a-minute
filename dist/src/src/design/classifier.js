/**
 * Design Task Classifier — Maps UI prompts to 13 design categories.
 */

export const DESIGN_CATEGORIES = [
  "new product",
  "new page",
  "new flow",
  "existing page modification",
  "component modification",
  "component creation",
  "redesign",
  "visual review",
  "responsive work",
  "accessibility work",
  "design-system work",
  "token modification",
  "content/copy work"
];

export function classifyDesignTask(prompt = "") {
  if (typeof prompt !== "string" || !prompt.trim()) return [];
  const q = prompt.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const matched = new Set();

  if (/\b(new\s+product|brand\s+new\s+app|create\s+app|from\s+scratch)\b/.test(q)) matched.add("new product");
  if (/\b(new\s+page|create\s+page|dashboard\s+page|landing\s+page)\b/.test(q)) matched.add("new page");
  if (/\b(flow|wizard|checkout|onboarding|multi-step)\b/.test(q)) matched.add("new flow");
  if (/\b(redesign|revamp|overhaul|refresh\s+ui)\b/.test(q)) matched.add("redesign");
  if (/\b(visual\s+review|critique|audit|check\s+ui|inspect\s+visual)\b/.test(q)) matched.add("visual review");
  if (/\b(responsive|mobile|tablet|breakpoint|media\s+query|stacking)\b/.test(q)) matched.add("responsive work");
  if (/\b(accessibility|a11y|contrast|wcag|screen\s+reader|focus|keyboard)\b/.test(q)) matched.add("accessibility work");
  if (/\b(design\s+system|primitive|token\s+system)\b/.test(q)) matched.add("design-system work");
  if (/\b(token|radius|spacing\s+token|color\s+token|rounded)\b/.test(q)) matched.add("token modification");
  if (/\b(content|copy|microcopy|empty\s+state\s+text|error\s+message)\b/.test(q)) matched.add("content/copy work");
  if (/\b(create\s+component|new\s+button|build\s+card)\b/.test(q)) matched.add("component creation");
  if (/\b(modify\s+component|update\s+button|edit\s+card|button\s+radius)\b/.test(q)) matched.add("component modification");
  
  // Default UI classification if UI keywords present but no specific subcategory matched
  if (matched.size === 0 && /\b(ui|ux|frontend|design|button|card|page|layout|css|tailwind|style|view)\b/.test(q)) {
    matched.add("existing page modification");
  }

  return Array.from(matched);
}

export function isUiTask(prompt = "") {
  return classifyDesignTask(prompt).length > 0;
}
