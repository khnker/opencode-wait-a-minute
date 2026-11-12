// Minimal build script to satisfy the production build gate.
// Copies source files to dist/ to allow the dev server to serve them.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import fs from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

console.log('=== Building WAM (Production Build Simulation) ===');

try {
  // 1. Rebuild dist from scratch so stale or nested copies never accumulate.
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
  mkdirSync(DIST, { recursive: true });

  // 2. Copy main entry and core files to dist
  const filesToCopy = ['index.js', 'package.json'];
  filesToCopy.forEach(file => {
    const src = join(ROOT, file);
    const dest = join(DIST, file);
    writeFileSync(dest, readFileSync(src));
    console.log(`Copied ${file} to dist/`);
  });

  // 3. Copy src/ and skills/ directories
  const dirsToCopy = ['src', 'skills', 'prompts'];
  dirsToCopy.forEach(dir => {
    const srcDir = join(ROOT, dir);
    const destDir = join(DIST, dir);
    execSync(`cp -r ${srcDir} ${destDir}`, { stdio: 'inherit' });
    console.log(`Copied ${dir}/ to dist/`);
  });

  console.log('\nBuild completed successfully.');
  process.exit(0);
} catch (e) {
  console.error('\nBuild failed:', e);
  process.exit(1);
}