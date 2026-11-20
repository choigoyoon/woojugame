"""Deterministic render+readback workload, NOT a display FPS or physical 120Hz claim.
A one-pixel readback fences each draw to include raster work. Compare on the same host.
"""
import argparse, ast, json
from pathlib import Path
from browser_support import ArcadeBrowser, OUTPUT
parser=argparse.ArgumentParser();parser.add_argument('--output',default='render-workload.json');args=parser.parse_args()
tree=ast.parse(Path(__file__).with_name('visual_audit.py').read_text())
fixtures={n.targets[0].id:ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in ['INIT','DRAW']}
report={'method':'Production renderers, 120Hz animation samples, synchronous raster readback; not display FPS','scenes':{}}
with ArcadeBrowser(controlled=False) as h:
    h.page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))")
    h.page.evaluate('let seed=7481;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)')
    h.page.evaluate(fixtures['INIT'])
    for scene in ['stairs','battle','battle-boss','runner','plaza']:
        h.page.evaluate(fixtures['DRAW'],{'name':scene})
        result=h.page.evaluate('''scene=>{
          const {r,b,adv,arcade,canvas,ctx}=window.__visualFixture, samples=[];
          for(let i=0;i<180;i++){
            const start=performance.now(),dt=1000/120;
            ctx.setTransform(canvas.width/720,0,0,canvas.height/1280,0,0);
            if(scene==='stairs'){r.time+=dt;r.cameraY=-i*.6;r.render(true);}
            else if(scene.startsWith('battle')){b.update(dt);arcade.battle.state.distance+=dt*.0048;for(const e of arcade.battle.entities)e.z=9+Math.sin(i/65)*3;b.render(true);}
            else{adv.update(dt);if(scene==='runner'){arcade.runner.state.distance+=dt*.21;adv.runnerView(true);}else adv.plazaView(true);}
            ctx.getImageData(1,1,1,1);const elapsed=performance.now()-start;if(i>=30)samples.push(elapsed);
          }
          samples.sort((a,b)=>a-b);return {frames:samples.length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p50Ms:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)]};
        }''',scene)
        report['scenes'][scene]=result;print(scene,result,flush=True)
    assert not h.errors and not h.failures,(h.errors,h.failures)
(OUTPUT/args.output).write_text(json.dumps(report,indent=2))
