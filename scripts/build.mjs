import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=(path)=>readFile(new URL(path,root),'utf8');
const bundled=new Set(),chunks=['const __modules = Object.create(null);'];
async function bundle(name){
  if(bundled.has(name))return;
  const source=await read('js/'+name);
  const imports=[...source.matchAll(/^import \{([^}]+)\} from ['"]\.\/([\w-]+\.js)['"];?$/gm)];
  for(const match of imports)await bundle(match[2]);
  const exports=[...source.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(match=>match[1]);
  for(const match of source.matchAll(/^export \{([^}]+)\};?$/gm))exports.push(...match[1].split(',').map(n=>n.trim()));
  const code=source.replace(/^import \{([^}]+)\} from ['"]\.\/([\w-]+\.js)['"];?$/gm,(_,names,path)=>`const {${names}} = __modules[${JSON.stringify(path)}];`).replace(/^export \{[^}]+\};?$/gm,'').replace(/^export /gm,'');
  chunks.push(`// ${name}\n__modules[${JSON.stringify(name)}] = (() => {\n${code}\nreturn { ${exports.join(', ')} };\n})();`);
  bundled.add(name);
}
await bundle('main.js');
const html=(await read('index.html')).replace(/<link rel="(?:manifest|icon|apple-touch-icon)"[^>]+>/g,'').replace('<link rel="stylesheet" href="./css/style.css">',`<style>\n${await read('css/style.css')}\n</style>`)
  .replace('<div id="loading" role="status">우주 오락실을 여는 중…</div>','').replace('<script type="module" src="./js/boot.js"></script>',`<script type="module">\n${chunks.join('\n').replaceAll('</script','<\\/script')}\n</script>`);
await mkdir(new URL('dist/',root),{recursive:true});await writeFile(new URL('dist/index.html',root),html);
console.log(`Standalone arcade: ${new URL('dist/index.html',root).pathname} (${bundled.size} modules)`);
