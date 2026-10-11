/**
 * Lifecycle Agent Instruction Loader
 * Dynamically loads context instructions based on task lifecycle stage.
 */
import fs from 'node:fs';
import path from 'node:path';

export function loadLifecycleInstructions(stage = 'explore', docsRoot = process.cwd()) {
  const map = {
    explore: '01-explore.md',
    implement: '02-implement.md',
    validate: '03-validate.md',
  };

  const candidateStages = Object.keys(map);
  if (!candidateStages.includes(stage)) {
    return 'Default lifecycle governance active.';
  }

  const filename = map[stage];
  const filePath = path.join(docsRoot, 'docs', 'lifecycle', filename);

  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch {}

  return 'Default lifecycle governance active.';
}
