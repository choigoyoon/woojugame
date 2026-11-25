"""Deterministic production-renderer fixtures; trusted input flow is tested separately.
Captures each equipped paid part and all required scenes at bar/fold/tablet sizes.
Never edits the player's profile or uses these fixtures in the shipping app.
"""
import json,sys
from browser_support import ArcadeBrowser, OUTPUT
OUT=OUTPUT/'visual-audit';OUT.mkdir(exist_ok=True)
INIT=r'''async ()=>{
 const names=['profile','arcade','renderer','battle-renderer','adventure-renderer','lobby','center','catalog','puzzle-renderer','juice'];
 const m={};for(const name of names)Object.assign(m,await import('./js/'+name+'.js'));
 const p=new m.Profile({getItem:()=>null,setItem:()=>{}});p.data.coins=12450;p.data.owned=m.PARTS.map(p=>p.id);p.data.equipped={head:'crown',body:'armor',back:'wings'};
 Object.assign(p.data.stats,{playMs:123*60000,brakes:40,brakeWins:36,gates:80,gateWins:67,sentences:32,missions:21,missionWins:18});
 // Detach the live application's canvas: a pending ResizeObserver must not overwrite fixtures.
 const original=document.querySelector('#scene'),canvas=document.createElement('canvas');canvas.id='scene';canvas.width=original.width;canvas.height=original.height;original.replaceWith(canvas);
 const arcade=new m.Arcade(p,()=>.4),ctx=canvas.getContext('2d',{alpha:false});
 const r=new m.Renderer(canvas,arcade.stairs),b=new m.BattleRenderer(ctx,arcade.battle,p),adv=new m.AdventureRenderer(ctx,arcade.runner,arcade.plaza,p),l=new m.Lobby(ctx,p),center=new m.Center(ctx,p),puzzle=new m.PuzzleRenderer(ctx,arcade.stairs,p),juice=new m.Juice(canvas,p);
 const noop={isPressed:()=>false};r.time=b.time=adv.time=l.time=center.time=1680;
 const btl=arcade.battle;btl.entities=[];btl.spawn('barrel',-.5,10,150);btl.spawn('enemy',.6,16,45);btl.gates=[{z:6,passed:false,correct:1,blueSide:0,options:[{text:'7 + 8',result:15},{text:'19 − 2',result:17}]}];btl.state.squad=36;b.displaySquad=24;btl.state.powerMs=2100;btl.shoot();
 arcade.runner.spawn('word',{x:310,slot:0,sentence:0});arcade.runner.spawn('word',{x:620,slot:1,sentence:0});arcade.runner.spawn('obstacle',{x:565});
 window.__visualFixture={p,arcade,r,b,adv,l,center,puzzle,juice,m,canvas,ctx};
 return m.PARTS.filter(p=>p.price>0).map(p=>p.id);
}'''
DRAW=r'''({name,bigNumbers=false})=>{
 const {p,arcade,r,b,adv,l,center,puzzle,juice,m,canvas,ctx}=window.__visualFixture;
 const bounds=document.querySelector('#game').getBoundingClientRect(),w=Math.round(bounds.width*devicePixelRatio),h=Math.round(bounds.height*devicePixelRatio);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 ctx.setTransform(canvas.width/720,0,0,canvas.height/1280,0,0);r.ratio=canvas.width/720;
 for(const id of ['crown','armor','wings'])p.equip(id);p.data.coins=bigNumbers?999999999:12450;
 juice.reset(name.split('-')[0]);
 if(name.startsWith('part-')){const id=name.slice(5),part=m.PARTS.find(p=>p.id===id);for(const base of ['pilot','coral','none'])p.equip(base);p.equip(id);center.open('profile');center.slot=part.slot;center.selected=id;center.render();}
 else if(name==='lobby'||name==='lobby-train'){p.data.progress.battle.harbor.rescued=name==='lobby-train'?7:0;l.render();}
 else if(name==='parents'){center.open('parents');center.stage='dashboard';center.render();}
 else if(name==='stairs'||name==='stairs-brake'){arcade.stairs.state.mode=name==='stairs-brake'?'auto-climb':'playing';arcade.stairs.state.combo=12;r.aura=name==='stairs-brake'?1200:0;r.render(true);if(name==='stairs-brake'){juice.impact({type:'brake-win',coins:15},r.pose.x,r.screenY(r.pose.y)-120);juice.hold=0;juice.update(260);juice.render();}}
 else if(name==='puzzle'){arcade.stairs.openPuzzle();puzzle.render(true);}
 else if(['battle','battle-boss','battle-fork','battle-stock','battle-clear','battle-complete'].includes(name)){
   const g=arcade.battle;g.state.phase='combat';g.harbor.state.locksBroken=0;g.harbor.state.locksSpawned=false;g.harbor.state.signalMs=0;g.entities=[];g.state.attack=null;g.spawn('barrel',-.5,10,150);g.spawn('enemy',.6,16,45);g.gates=[{z:6,passed:false,correct:1,blueSide:0,options:[{text:'7 + 8',result:15},{text:'19 − 2',result:17}]}];for(const v of b.impacts)v.life=0;
   if(name==='battle-boss'){g.gates=[];g.entities=[];g.spawn('boss',0,9,500);g.entities[0].hp=265;g.entities[0].crack=2;g.entities[0].hitMs=80;g.harbor.after();g.harbor.state.signalMs=0;g.state.attack={lane:2,phase:'warning',remainingMs:700};b.handle({type:'hit',id:g.entities[0].id,kind:'boss',x:0,z:9,damage:72});}
   if(name==='battle-fork'||name==='battle-stock'){g.entities=[];g.gates=[];g.harbor.encounter(name==='battle-fork'?'armory':'stock');for(const e of g.entities)e.z=5;g.harbor.state.shields=2;}
   if(name==='battle-clear'||name==='battle-complete'){g.state.phase=name==='battle-clear'?'result':'complete';g.state.round=name==='battle-clear'?0:2;g.progress.round=g.state.round;g.progress.cleared=g.state.round+1;g.state.resultMs=1000;g.harbor.state.medals=5;g.progress.unlocked={pulse:1,spread:1,pierce:2,arc:1};}
   b.render(true);
 }
 else if(name==='runner'||name==='runner-gold'){
   const s=arcade.runner.state;s.slot=name==='runner-gold'?3:0;s.goldMs=name==='runner-gold'?3900:0;s.y=name==='runner-gold'?45:0;s.messageMs=s.goldMs?1000:0;s.message='GOLD RUSH!';adv.runnerView(true);
   if(s.goldMs){juice.impact({type:'sentence',coins:30},180,700);juice.hold=0;juice.update(220);juice.render();}
 }else if(name.startsWith('plaza')){
   const s=arcade.plaza.state;s.phase=name==='plaza-brief'?'briefing':name==='plaza-clear'?'success':'active';s.x=1;s.z=3.1;s.collectedA=s.phase==='success'?2:0;s.collectedB=s.phase==='success'?1:0;
   adv.joystick=s.phase==='active'?{x:570,y:1090,knobX:604,knobY:1054}:null;adv.plazaView(true);
   if(s.phase==='success'){juice.impact({type:'mission-win',coins:50},360,490);juice.hold=0;juice.update(330);juice.render();}
 }
 return {size:[canvas.width,canvas.height],coins:p.data.coins,part:p.equipped};
}'''
report={'fixtures':'Production renderer calls on isolated deterministic model fixtures, not gameplay proofs','screens':[]}
with ArcadeBrowser() as h:
    h.page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide'))")
    parts=h.page.evaluate(INIT)
    scenes=['lobby','parents','stairs','stairs-brake','puzzle','battle','battle-boss','battle-fork','battle-stock','battle-clear','battle-complete','lobby-train','runner','runner-gold','plaza','plaza-brief','plaza-clear']+['part-'+p for p in parts]
    for device,width,height in [('bar',412,915),('fold',768,1024),('tablet',1024,1366)]:
        h.page.set_viewport_size({'width':width,'height':height});h.advance(60)
        for scene in scenes:
            data=h.page.evaluate(DRAW,{'name':scene});path=OUT/(device+'-'+scene+'.png');h.page.locator('#game').screenshot(path=str(path))
            box=h.page.locator('#game').bounding_box();assert abs(box['width']/box['height']-9/16)<.002
            assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1
            report['screens'].append({'device':device,'scene':scene,'file':path.name,'viewport':[width,height],'gameBounds':box,**data})
        for scene in ['lobby','parents','runner','part-crown']:
            h.page.evaluate(DRAW,{'name':scene,'bigNumbers':True});h.page.locator('#game').screenshot(path=str(OUT/(device+'-max-'+scene+'.png')))
        h.page.screenshot(path=str(OUT/(device+'-full-viewport.png')))
    assert not h.errors and not h.failures,(h.errors,h.failures)
report['errors']=[]
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('Captured',len(report['screens']),'required frames + 12 large-counter frames + 3 full viewports')
