// Minimal dev server for E2E verification
// Serves static files from dist/ on port 4321
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const PORT = Number(process.env.WAM_DEV_PORT) || 4321;
const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

const server = createServer((req, res) => {
  try {
    // Serve index.js as main entry
    if (req.url === '/' || req.url === '') {
      const indexPath = join(DIST, 'index.js');
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(content);
        return;
      }
    }
    // Serve other static files
    const filePath = join(DIST, req.url);
    if (existsSync(filePath)) {
      const ext = filePath.split('.').pop();
      const mime = {
        'js': 'application/javascript',
        'css': 'text/css',
        'html': 'text/html',
        'json': 'application/json',
        'png': 'image/png',
        'svg': 'image/svg+xml',
      }[ext] || 'text/plain';
      const content = readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': mime });
      res.end(content);
      return;
    }
    // Not found
    res.writeHead(404);
    res.end('Not Found');
  } catch (e) {
    console.error('Server error:', e);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Dev server listening on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());