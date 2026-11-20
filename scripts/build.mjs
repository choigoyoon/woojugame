import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const modules = ['config', 'game', 'input', 'audio', 'renderer', 'main'];
const code = (await Promise.all(modules.map(async (name) => {
  const source = await read(`js/${name}.js`);
  return `// ${name}.js\n${source.replace(/^import .+;\n/gm, '').replace(/^export /gm, '')}`;
}))).join('\n\n');
const html = (await read('index.html'))
  .replace('<link rel="stylesheet" href="./css/style.css">', `<style>\n${await read('css/style.css')}\n</style>`)
  .replace('<script type="module" src="./js/main.js"></script>', `<script type="module">\n${code.replaceAll('</script', '<\\/script')}\n</script>`);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
console.log(`Standalone game: ${new URL('dist/index.html', root).pathname}`);
