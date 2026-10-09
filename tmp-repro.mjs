import fs from 'fs';
import path from 'path';
import { searchBaseline } from './benchmarks/retrieval/search-baseline.mjs';

const d = fs.mkdtempSync(path.join(fs.realpathSync('/home/nicolas/dev/wait-a-minute-plugin'), 'tmp-fixture'));
fs.writeFileSync(path.join(d, 'a.js'), 'const x = 1;');
fs.writeFileSync(path.join(d, 'b.js'), 'const x = 2;');
const r = searchBaseline('const x', { repoRoot: d, maxResults: 5 });
console.log('CONTRADICTION:', JSON.stringify(r));
fs.rmSync(d, { recursive: true, force: true });

// scope respect
const d2 = fs.mkdtempSync(path.join(fs.realpathSync('/home/nicolas/dev/wait-a-minute-plugin'), 'tmp-fixture'));
fs.writeFileSync(path.join(d2, 'inside.js'), 'target = 42');
const outside = path.join(d2, '..', 'outside-leak.js');
fs.writeFileSync(outside, 'target = 99');
const r2 = searchBaseline('target', { repoRoot: d2, maxResults: 5 });
console.log('SCOPE:', JSON.stringify(r2));
fs.rmSync(d2, { recursive: true, force: true });
fs.rmSync(outside, { force: true });
