"""Real RAF integration with explicit synthetic main-thread load; not a device benchmark."""
import ast,json
from pathlib import Path
from browser_support import ArcadeBrowser,OUTPUT
report={'environment':'Headless Chromium; synthetic 18ms draw load for adaptive-resolution integration','checks':[]}
with ArcadeBrowser(controlled=False) as h:
    h.tap('mode-plaza');h.tap('plaza-start');h.advance(100)
    x,y=h.point(360,1090)
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
    initial=h.state();bounds=h.page.locator('#game').bounding_box()
    # Inject rendering pressure only in the test page. Shipping code has no test-only controls.
    h.page.evaluate('''()=>{
      const target=document.querySelector('#scene').getContext('2d'),original=target.setTransform.bind(target);
      window.__load=true;let loadedAt=-100;
      target.setTransform=(...args)=>{const now=performance.now();if(window.__load&&now-loadedAt>22){loadedAt=now;while(performance.now()-now<18){}}return original(...args);};
    }''')
    h.page.wait_for_function('window.__uju.snapshot().performance.scale<1',timeout=16000)
    h.advance(100);adapted=h.state()
    assert adapted['activeInputs']==1 and adapted['dragId']==initial['dragId'] and adapted['joystick'],adapted
    assert adapted['screen']=='plaza' and adapted['performance']['backingWidth']<initial['performance']['backingWidth']
    assert h.page.locator('#game').bounding_box()==bounds
    # Redundant viewport notifications must not steal the live gesture or reallocate the canvas.
    h.page.evaluate("window.dispatchEvent(new Event('resize'));window.visualViewport?.dispatchEvent(new Event('resize'))")
    assert h.state()['activeInputs']==1
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':x+18,'y':y-9}]})
    moved=h.state();assert moved['joystick']['knobX']!=initial['joystick']['knobX'] and moved['canHome']==False
    h.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    h.page.evaluate('window.__load=false');h.advance(100)
    assert h.state()['activeInputs']==0
    report['checks'].append('Adaptive backing resize preserves held joystick, touch coordinates, CSS bounds, and home safety; duplicate resize notifications preserve input')
    h.page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))");paused=h.state();h.advance(250)
    assert h.state()['frames']==paused['frames']
    h.page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow'))");h.advance(300)
    assert h.state()['frames']>paused['frames'] and not h.state()['paused']
    h.page.set_viewport_size({'width':768,'height':1024});h.advance(150)
    assert h.state()['activeInputs']==0
    report['checks'].append('Pause stops RAF, resume restarts it, real fold resize retains state and clears input')
    report['before']=initial['performance'];report['after']=adapted['performance']
    h.capture('adaptive-plaza-fold')
    # Perspective must not generate a new material sprite for every floating-point depth.
    h.page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))")
    tree=ast.parse(Path(__file__).with_name('visual_audit.py').read_text())
    fixtures={n.targets[0].id:ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in ['INIT','DRAW']}
    h.page.evaluate(fixtures['INIT']);h.page.evaluate(fixtures['DRAW'],{'name':'battle-boss'})
    cache=h.page.evaluate('''async()=>{
      const {materialStats}=await import('./js/material.js'),{b,arcade,ctx}=window.__visualFixture,e=arcade.battle.entities[0];
      b.barrel(e);const before=materialStats();for(let i=0;i<1000;i++){e.z=3+i*.02;b.barrel(e);}ctx.getImageData(1,1,1,1);
      return{before,after:materialStats()};
    }''')
    assert cache['after']['blockBuilds']==cache['before']['blockBuilds'],cache
    report['checks'].append('1,000 distinct boss depths create zero additional block sprites after warmup')
    report['materials']=cache
    equipment=h.page.evaluate('''()=>{
      const {p,b}=window.__visualFixture;
      const checksum=surface=>surface.getContext('2d').getImageData(0,0,surface.width,surface.height).data.reduce((n,v,i)=>(n+v*(i%97+1))%2147483647,0);
      b.prepareTroops();b.hud(true);const hud=checksum(b.art.layers.get('hud').surface),troop=checksum(b.troopSprites[0]);
      p.equip('cat');b.prepareTroops();b.hud(true);
      return{hudChanged:hud!==checksum(b.art.layers.get('hud').surface),troopChanged:troop!==checksum(b.troopSprites[0])};
    }''')
    assert equipment['hudChanged'] and equipment['troopChanged'],equipment
    report['checks'].append('Equipping a new part updates actual HUD and troop sprite pixels after cache warmup')
    fallback=h.page.evaluate('''async()=>{
      const Native=window.OffscreenCanvas;window.OffscreenCanvas=undefined;
      try{const {Art}=await import('./js/art.js'),surface=document.createElement('canvas');surface.width=720;surface.height=1280;
        const a=new Art(surface.getContext('2d'));a.cached('cropped',[20,20,100,100],()=>a.home(true));
        return{layers:a.layers.size,scale:a.layerScale,pixel:[...a.c.getImageData(65,44,1,1).data]};
      }finally{window.OffscreenCanvas=Native;}
    }''')
    assert fallback['layers']==2 and fallback['scale']==1 and fallback['pixel'][3]>0,fallback
    report['checks'].append('Nested cropped caches retain root density with HTMLCanvas fallback when OffscreenCanvas is unavailable')
    assert not h.errors and not h.failures,(h.errors,h.failures)
(OUTPUT/'frame-budget-browser.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
