import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('entry assets and every ES module resolve beneath the GitHub Pages project path', async () => {
  const root = new URL('../', import.meta.url);
  const page = new URL('https://choigoyoon.github.io/woojugame/');
  const html = await readFile(new URL('index.html', root), 'utf8');
  const assetPaths = [...html.matchAll(/(?:src|href)="([^\"]+)"/g)]
    .map((match) => match[1]).filter((path) => !path.startsWith('data:'));
  const pending = assetPaths.map((path) => new URL(path, page));
  const visited = new Set();
  while (pending.length) {
    const asset = pending.pop();
    if (visited.has(asset.href)) continue;
    assert.equal(asset.origin, page.origin, 'Assets must remain on the Pages origin');
    assert.ok(asset.pathname.startsWith(page.pathname), `Asset escaped /woojugame/: ${asset.href}`);
    const relative = asset.pathname.slice(page.pathname.length);
    const content = await readFile(new URL(relative, root), 'utf8');
    visited.add(asset.href);
    for (const match of content.matchAll(/^import .*?from ['"]([^'"]+)['"]/gm)) {
      pending.push(new URL(match[1], asset));
    }
  }
  assert.ok(visited.has(new URL('./css/style.css', page).href));
  for (const module of ['main', 'config', 'game', 'input', 'renderer', 'audio']) {
    assert.ok(visited.has(new URL(`./js/${module}.js`, page).href), `${module} must be loaded`);
  }
});
