import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || 3000);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    // Serve only game assets; repository documents and .git stay private.
    if (relative !== 'index.html' && !/^(js\/[\w-]+\.js|css\/[\w-]+\.css)$/.test(relative)) {
      response.writeHead(404); response.end('Not found'); return;
    }
    const path = resolve(root, relative);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error('Invalid path');
    const body = await readFile(path);
    const extension = path.slice(path.lastIndexOf('.'));
    response.writeHead(200, { 'Content-Type': `${types[extension]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});
server.listen(port, '0.0.0.0', () => {
  const actualPort = server.address().port;
  console.log(`Uju Block Run: http://localhost:${actualPort}`);
  console.log(`Mobile: open http://<this computer's LAN IP>:${actualPort} on the same Wi-Fi.`);
});
