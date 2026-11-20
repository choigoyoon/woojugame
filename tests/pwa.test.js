import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
test('committed PWA revision exactly matches every shipped offline asset and maskable icon',async()=>{
  const sw=await readFile(new URL('sw.js',root),'utf8');
  const files=JSON.parse(sw.match(/const FILES=(\[[\s\S]*?\]);/)[1]);
  const hash=createHash('sha256');for(const name of files){const path=name.slice(2);hash.update(path).update(await readFile(new URL(path,root)));}
  assert.equal(sw.match(/const VERSION="([a-f0-9]+)"/)[1],hash.digest('hex').slice(0,12),'Run npm run pwa after changing app files');
  for(const name of await readdir(new URL('js/',root)))if(name.endsWith('.js'))assert.ok(files.includes('./js/'+name));
  const m=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));assert.equal(m.scope,'./');assert.equal(m.start_url,'./');assert.equal(m.display,'fullscreen');
  assert.ok(m.icons.some(i=>i.purpose==='maskable'));for(const i of m.icons){const bytes=await readFile(new URL(i.src,root));assert.equal(bytes.readUInt32BE(16),Number(i.sizes.split('x')[0]));assert.equal(bytes.readUInt32BE(20),Number(i.sizes.split('x')[1]));}
});
