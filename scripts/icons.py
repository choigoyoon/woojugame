"""Generate first-party Canvas icons, including an 80% maskable safe circle."""
import base64, os, re, shutil, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
server=subprocess.Popen(['node','scripts/serve.mjs','--port','0'],cwd=ROOT,stdout=subprocess.PIPE,text=True)
url=re.search(r'http://\S+',server.stdout.readline()).group().replace('localhost','127.0.0.1')
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'))
        page=browser.new_page();page.goto(url)
        for name,size,maskable in [('icon-192',192,False),('icon-512',512,False),('maskable-512',512,True)]:
            data=page.evaluate('''async ({size,maskable})=>{
              const {Art}=await import('./js/art.js');const {paletteFor}=await import('./js/catalog.js');
              const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
              const c=canvas.getContext('2d');c.scale(size/512,size/512);const a=new Art(c);
              c.fillStyle=a.gradient(0,0,512,512,['#134564','#30336f','#211b4d']);c.fillRect(0,0,512,512);
              for(let i=0;i<18;i++)a.star((i*137+25)%512,(i*193+41)%512,3+i%4,'#aad6f388');
              const scale=maskable?.83:1;c.translate(256,256);c.scale(scale,scale);c.translate(-256,-256);
              a.ellipse(256,368,156,44,'#8d70c5');a.ellipse(256,351,156,40,'#c0a6ed');
              a.toy(247,348,1.42,{palette:paletteFor({head:'crown',body:'coral',back:'wings'})});
              a.star(135,168,20,'#ffe6a0');a.star(381,204,14,'#83ffdc');
              a.rect(160,387,192,53,'#11284c',20,'#8bbfda');a.text('UJU',256,416,35,'#ffdf8d');
              return canvas.toDataURL('image/png').split(',')[1];
            }''',{'size':size,'maskable':maskable})
            (ROOT/'icons').mkdir(exist_ok=True);(ROOT/'icons'/f'{name}.png').write_bytes(base64.b64decode(data))
        browser.close()
finally:
    server.terminate();server.wait(timeout=5)
print('Generated 192 / 512 / maskable Canvas icons.')
