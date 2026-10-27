/**
 * Design Integration for Context Assembly — handles design axis selection and budgeting.
 */

import { classifyDesignTask, isUiTask } from "./classifier.js";
import { loadDesignContext } from "./design-context.js";

export function assembleDesignAxis({ prompt = "", projectPath = process.cwd(), flex = 1000 } = {}) {
  if (!isUiTask(prompt)) {
    return { active: false, tokens: 0, line: null, selected: [], excluded: [] };
  }

  const categories = classifyDesignTask(prompt);
  const primaryCategory = categories[0] || "existing page modification";
  const designCtx = loadDesignContext(projectPath);

  // Determine minimum sufficient references based on categories
  const allRefs = [
    "tokens.md",
    "design-context.md",
    "composition.md",
    "components.md",
    "patterns.md",
    "states.md",
    "responsive.md",
    "accessibility.md",
    "anti-slop.md",
    "visual-review.md",
    "content.md",
    "visual-direction.md",
    "design-system.md"
  ];

  const selected = ["tokens.md", "design-context.md"];
  if (categories.includes("new page") || categories.includes("new product") || categories.includes("new flow")) {
    selected.push("composition.md", "responsive.md", "states.md");
  }
  if (categories.includes("accessibility work")) {
    selected.push("accessibility.md");
  }
  if (categories.includes("component modification") || categories.includes("component creation")) {
    selected.push("components.md", "states.md");
  }
  if (categories.includes("token modification")) {
    // only tokens + affected component
    selected.splice(1, 1); // remove design-context if strict trivial token mod
  }

  const excluded = allRefs.filter(r => !selected.includes(r));
  const estimatedTokens = selected.length * 150 + (designCtx.exists ? 200 : 50);

  const refsStr = selected.join(",");
  const excludedStr = excluded.slice(0, 3).join(",");
  const line = `[wam design budget] selected=${refsStr} excluded=${excludedStr} tokens=${estimatedTokens} reason=${primaryCategory}`;

  return {
    active: true,
    tokens: estimatedTokens,
    line,
    selected,
    excluded,
    reason: primaryCategory
  };
}
