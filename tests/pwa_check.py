"""Cold offline browser restart and safe SW replacement using a copied deployment fixture."""
import json, os, re, shutil, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_support import ROOT, OUTPUT

report={'checks':[]}
with tempfile.TemporaryDirectory(prefix='uju-pwa-') as temp:
    root=Path(temp)/'site';root.mkdir()
    for name in ['index.html','manifest.json','sw.js','js','css','icons','scripts']:
        source=ROOT/name
        if source.is_dir():shutil.copytree(source,root/name)
        else:shutil.copy2(source,root/name)
    serve=root/'scripts/serve.mjs';serve.write_text(serve.read_text().replace("'Cache-Control': 'no-store'","'Cache-Control': 'public, max-age=31536000'"))
    server=subprocess.Popen(['node','scripts/serve.mjs','--port','0','--base','/woojugame/'],cwd=root,stdout=subprocess.PIPE,text=True)
    base=re.search(r'http://\S+',server.stdout.readline()).group().replace('localhost','127.0.0.1')
    try:
        with sync_playwright() as p:
            executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
            data=Path(temp)/'browser'
            def context(offline=False):return p.chromium.launch_persistent_context(str(data),headless=True,executable_path=executable,viewport={'width':412,'height':915},is_mobile=True,has_touch=True,offline=offline)
            ctx=context();page=ctx.pages[0];errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            # Reproduce the 0.3 -> first PWA upgrade: an incompatible module remains fresh in HTTP cache.
            config=root/'js/config.js';fresh=config.read_text();config.write_text('throw new Error("legacy cached module");')
            page.goto(base+'manifest.json');assert 'legacy cached module' in page.evaluate("fetch('./js/config.js').then(r=>r.text())")
            config.write_text(fresh);assert 'legacy cached module' in page.evaluate("fetch('./js/config.js').then(r=>r.text())")
            page.goto(base+'?debug');page.bring_to_front();page.evaluate('window.__ujuReady');assert page.evaluate('!!window.__uju')
            report['checks'].append('first PWA boot replaces incompatible fresh legacy HTTP cache before importing game modules')
            page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('!!navigator.serviceWorker.controller')
            manifest=page.evaluate("fetch('./manifest.json').then(r=>r.json())")
            assert manifest['start_url']=='./' and manifest['scope']=='./' and manifest['display']=='fullscreen' and manifest['orientation']=='portrait'
            for icon in manifest['icons']:
                assert page.evaluate("async src=>{const i=new Image();i.src=src;await i.decode();return i.width;}",icon['src'])==int(icon['sizes'].split('x')[0])
            cdp=ctx.new_cdp_session(page)
            try:report['installability']=cdp.send('Page.getInstallabilityErrors')
            except Exception:report['installability']='CDP audit unavailable; Android install remains manual'
            keys=page.evaluate('caches.keys()');assert len([k for k in keys if k.startswith('uju-arcade:/woojugame/:')])==1
            count=page.evaluate("async()=>{const keys=await caches.keys();return (await (await caches.open(keys[0])).keys()).length;}")
            report['cachedAssets']=count
            # Test fixture grants owned parts as an existing wallet, then actual gameplay saves it.
            page.evaluate("window.dispatchEvent(new Event('pagehide'));localStorage.setItem('uju-arcade-profile',JSON.stringify({version:3,coins:812,owned:['pilot','coral','none','cat','mint','wings'],equipped:{head:'cat',body:'mint',back:'wings'}}))")
            page.reload();page.wait_for_function('!!window.__uju');page.locator('#mode-runner').tap();page.wait_for_timeout(1200)
            page.locator('#home').tap();page.wait_for_function("window.__uju.snapshot().screen==='lobby'")
            saved=page.evaluate('window.__uju.snapshot().profile');ctx.close()

            # Entire browser process dies; launch the same installed profile with network unavailable.
            ctx=context(True);page=ctx.pages[0];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'?debug');page.bring_to_front();page.wait_for_function('!!window.__uju')
            state=page.evaluate('window.__uju.snapshot()');assert state['profile']['coins']==saved['coins'] and state['profile']['equipped']==saved['equipped']
            assert not state['runner']['recovered']
            for mode in ['stairs','battle','runner','plaza']:
                page.locator('#mode-'+mode).tap();page.wait_for_timeout(950);assert page.evaluate('window.__uju.snapshot().screen')==mode
                page.locator('#home').tap();page.wait_for_function("window.__uju.snapshot().screen==='lobby'")
            page.locator('#game').screenshot(path=str(OUTPUT/'production-offline.png'))
            report['checks'].append('all precached assets, manifest/icon dimensions, whole browser exit and offline restart, four modes and owned parts/coins restored')
            # Damage the primary document; the second durable copy must recover the latest wallet.
            page.evaluate("window.dispatchEvent(new Event('pagehide'));localStorage.setItem('uju-arcade-profile','{corrupt')");page.reload();page.wait_for_function('!!window.__uju')
            assert page.evaluate('window.__uju.snapshot().profile.equipped.back')=='wings',page.evaluate('window.__uju.snapshot().profile')
            assert page.evaluate('window.__uju.snapshot().profile.coins')>=saved['coins']
            report['checks'].append('offline corrupt-primary recovery from redundant saved profile')
            ctx.set_offline(False)
            # A partially deployed update cannot replace the complete current worker/cache.
            sw=root/'sw.js';original=sw.read_text();sw.write_text(original.replace("const VERSION=", "const VERSION='bad-'+").replace('const FILES=[','const FILES=["./missing-required.js",'))
            page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update()).catch(()=>{})");page.wait_for_timeout(1700)
            assert page.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)")==False
            assert page.evaluate('caches.keys()')==keys
            # Complete new revision waits. An explicit update saves, activates, then reloads.
            sw.write_text(original.replace('const VERSION=',"const VERSION='next-';//"))
            page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
            page.wait_for_selector('#app-update',timeout=15000)
            assert page.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)")
            before=page.evaluate('window.__uju.snapshot().profile.coins')
            page.get_by_role('button',name='저장하고 다시 열기').click();page.wait_for_function("!!window.__uju && !document.querySelector('#app-update')")
            page.wait_for_function("async()=>!(await caches.keys()).some(k=>k.includes('bad-')) && (await caches.keys()).some(k=>k.endsWith('next-'))")
            assert page.evaluate('window.__uju.snapshot().profile.coins')==before
            assert len(page.evaluate('caches.keys()'))==1
            report['checks'].append('failed partial update retains previous cache; complete update waits for consent and preserves wallet; old scoped cache removed')
            assert not errors,errors;report['errors']=errors;ctx.close()
    finally:server.terminate();server.wait(timeout=5)
(OUTPUT/'pwa-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
