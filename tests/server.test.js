import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('dev command serves all entry-point assets with module MIME types and keeps repository files private', async () => {
  const child = spawn(process.execPath, ['scripts/serve.mjs', '--port', '0'], {
    cwd: new URL('../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Dev server did not start')), 5000);
      let output = '';
      child.stdout.on('data', (data) => {
        output += data;
        const match = output.match(/http:\/\/localhost:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      child.once('error', (error) => { clearTimeout(timeout); reject(error); });
      child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Dev server exited: ${code}`)); });
    });
    const base = `http://127.0.0.1:${port}`;
    const index = await fetch(base);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /type="module" src="\.\/js\/main.js"/);
    for (const module of ['main', 'config', 'game', 'input', 'renderer', 'audio']) {
      const response = await fetch(`${base}/js/${module}.js`);
      assert.equal(response.status, 200, module);
      assert.match(response.headers.get('content-type'), /text\/javascript/);
    }
    assert.equal((await fetch(`${base}/css/style.css`)).status, 200);
    for (const path of ['/README.md', '/.git/config', '/manifest.json', '/sw.js']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
  } finally {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
});
