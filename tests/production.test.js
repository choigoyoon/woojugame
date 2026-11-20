import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, ACTION, MODE } from '../js/config.js';
import { Pool, InputBuffer, Haptics } from '../js/engine.js';
import { FrameClock, Arcade } from '../js/arcade.js';
import { Profile } from '../js/profile.js';
import { PARTS } from '../js/catalog.js';
import { Battle } from '../js/battle.js';
import { CampaignBattle } from '../js/campaign.js';
import { Game } from '../js/game.js';
import { Runner } from '../js/runner.js';
import { Plaza, missionFor } from '../js/plaza.js';
import { SENTENCES } from '../js/sentences.js';

const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const wait=(b,ms)=>{for(let left=ms;left>1e-7;left-=50)b.advance(Math.min(left,50));};
const seeded=()=>{let seed=42;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};};

test('60, 90, 120 Hz simulate identical combat, runner and plaza ticks; runtime clamp is 50ms',()=>{
  const clock=new FrameClock();assert.equal(clock.tick(4000),50);assert.equal(clock.tick(4010),10);
  const runs=[];
  for(const hz of [60,90,120]){
    const b=new Battle(seeded()),r=new Runner(new Profile(null)),p=new Plaza(new Profile(null));
    r.setPaused(false);p.setPaused(false);p.start();p.move(.4,-.3);r.press();b.steer(.4);
    for(let frame=0;frame<hz*10;frame++){const dt=1000/hz;b.advance(dt);r.advance(dt);p.advance(dt);b.takeEvents();r.takeEvents();p.takeEvents();}
    runs.push({distance:b.state.distance,shots:b.state.shots,kills:b.state.kills,coins:b.state.coins,elapsed:b.state.elapsedMs,runner:r.state,plaza:p.state});
  }
  assert.deepEqual(runs[1],runs[0]);assert.deepEqual(runs[2],runs[0]);
  for(const hz of [60,90,120]){const g=new Game(()=>.5,{events:false});g.stumble();for(let f=0;f<hz;f++)g.advance(1000/hz);assert.equal(g.state.mode,MODE.PLAYING);}
});

test('bounded pools recycle original identities and expire input at the 100ms boundary',()=>{
  const pool=new Pool(4),original=new Set(pool.items);for(let n=0;n<10000;n++){pool.acquire({n});pool.prune(x=>x.n>n-2);assert.ok(pool.active.every(x=>original.has(x)));assert.equal(pool.active.length+pool.free.length,4);}
  const buffer=new InputBuffer();buffer.push('jump',100);assert.equal(buffer.take(200),'jump');buffer.push('turn',100);assert.equal(buffer.take(200.001),null);
  const b=new Battle(seeded()),bullets=new Set(b.bulletPool.items),entities=new Set(b.entityPool.items);wait(b,10000);
  assert.ok(b.bullets.every(x=>bullets.has(x)));assert.ok(b.entities.every(x=>entities.has(x)));
});

test('stair recovery accepts last-100ms ordered turn/climb, clears on pause, and never buffers a brake violation',()=>{
  const g=new Game(()=>.5,{events:false});g.stumble();g.advance(920);g.act(ACTION.TURN);g.act(ACTION.CLIMB);g.advance(80);assert.equal(g.metrics.received,4);assert.ok(g.takeEvents().some(e=>e.type==='turn'));
  g.stumble();g.advance(920);g.act(ACTION.TURN);g.setPaused(true);g.setPaused(false);g.advance(80);assert.equal(g.buffer.pool.active.length,0);
  g.state.mode=MODE.BRAKE_HOLD;g.state.brakeRemainingMs=20;assert.equal(g.act(ACTION.CLIMB).type,'stumble');assert.equal(g.buffer.pool.active.length,0);
});

test('friendly gate margin and harmful boss bounds use separate 120% / 85% rules',()=>{
  const b=new Battle();b.state.x=.07;b.passGate({passed:false,correct:0,options:[{result:8,text:'4 + 4'},{result:5,text:'2 + 3'}]});assert.equal(b.state.gateResult.good,true);
  b.state.x=.09;b.passGate({passed:false,correct:0,options:[{result:8,text:'4 + 4'},{result:5,text:'2 + 3'}]});assert.equal(b.state.gateResult.good,false);
  b.state.x=-.05;assert.equal(b.attackHits({lane:0}),false);b.state.x=-.08;assert.equal(b.attackHits({lane:0}),true);
});

test('runner supports variable jump, buffered landing, 24 natural sets and one-time sentence rewards',()=>{
  assert.ok(SENTENCES.length>=20);assert.equal(new Set(SENTENCES.map(s=>s.slice(0,3).join(' '))).size,SENTENCES.length);
  const peak=hold=>{const r=new Runner(new Profile(null));r.setPaused(false);r.press();let max=0;for(let t=0;t<1000;t+=5){if(t===hold)r.releaseJump();r.advance(5);max=Math.max(max,r.state.y);}return max;};assert.ok(peak(220)>peak(40)+40);
  const profile=new Profile(memory()),r=new Runner(profile);r.setPaused(false);r.state.y=7;r.state.vy=-200;r.press();wait(r,80);assert.ok(r.state.vy>0,'landing consumed buffered jump');
  r.release();r.state.y=0;r.state.vy=0;
  const wrong=r.spawn('word',{slot:1});r.hitWord(wrong);assert.equal(r.state.slot,0);assert.equal(profile.data.stats.sentences,0);
  for(let slot=0;slot<3;slot++){const word=r.spawn('word',{slot,sentence:0});r.hitWord(word);r.hitWord(word);r.items.prune(i=>!i.dead);}
  r.save();assert.equal(r.state.goldMs,5000);assert.equal(profile.coins,45);assert.equal(profile.data.stats.sentences,1);
  const restored=new Runner(new Profile(profile.storage));assert.equal(restored.recovered,false);assert.equal(restored.state.slot,3);assert.equal(restored.state.goldMs,5000);
  restored.setPaused(false);wait(restored,5000);assert.equal(restored.state.slot,0);assert.equal(restored.state.sentence,1);assert.equal(restored.profile.data.stats.sentences,1);
});

test('runner heading uses swept crossing and enlarged pickup extent, not a text click',()=>{
  const r=new Runner(new Profile(null));r.setPaused(false);r.items.clear();r.state.spawnMs=10000;r.state.obstacleMs=10000;
  r.spawn('word',{x:CONFIG.runner.playerX+110,y:590,slot:0});r.state.y=85;r.state.vy=500;r.advance(5);assert.equal(r.state.slot,1);
});

test('plaza requires exact cargo and captain return; distractions reset mission without charging coins',()=>{
  const profile=new Profile(memory()),p=new Plaza(profile);p.setPaused(false);p.start();
  for(const i of p.items.active)if(p.mission.some(m=>m.kind===i.kind))p.collect(i);
  assert.equal(p.ready,true);assert.equal(profile.coins,0);p.state.x=0;p.state.z=3.15;p.advance(5);
  assert.equal(p.state.phase,'success');assert.equal(profile.coins,50);assert.equal(profile.data.stats.missionWins,1);wait(p,1000);assert.equal(profile.coins,50);
  const restored=new Plaza(new Profile(profile.storage));assert.equal(restored.recovered,false);assert.equal(restored.state.phase,'success');restored.setPaused(false);restored.start();restored.start();
  restored.collect(restored.items.active.find(i=>i.kind==='book'));restored.save();assert.equal(restored.state.phase,'retry');assert.equal(restored.profile.coins,50);
  wait(restored,1000);assert.equal(restored.state.phase,'briefing');assert.equal(restored.state.collectedA,0);assert.equal(restored.profile.data.stats.missions,2);
  assert.ok(missionFor(10).reduce((a,m)=>a+m.count,0)>missionFor(0).reduce((a,m)=>a+m.count,0));
});

test('v1/v2 migrate to v3; damaged primary restores purchases, settings and checkpoints from backup',()=>{
  const storage=memory();storage.setItem(CONFIG.arcade.storageKey,JSON.stringify({version:2,coins:1500,owned:['pilot','coral','none'],equipped:{head:'pilot',body:'coral',back:'none'}}));
  const p=new Profile(storage);assert.equal(p.data.version,3);assert.equal(p.buy('jet'),'bought');p.setting('haptics');
  const r=new Runner(p);r.setPaused(false);wait(r,1200);r.setPaused(true);storage.setItem(CONFIG.arcade.storageKey,'{broken');
  const recovered=new Profile(storage);assert.equal(recovered.status,'recovered');assert.equal(recovered.coins,1200);assert.equal(recovered.equipped.back,'jet');assert.equal(recovered.data.settings.haptics,false);
  assert.equal(new Runner(recovered).state.elapsedMs,r.state.elapsedMs);
  storage.setItem(CONFIG.arcade.storageKey+'.backup','broken');assert.equal(new Profile(storage).coins,0);
});

test('corrupt adventure data restarts only that mode without losing the shared wallet',()=>{
  for(const [mode,Model]of [['runner',Runner],['plaza',Plaza]]){
    const p=new Profile(memory());p.credit(700);const model=new Model(p);model.save();p.data.progress[mode].checkpoint.state.x=1e30;p.save();
    const restored=new Model(new Profile(p.storage));assert.equal(restored.recovered,true);assert.equal(restored.profile.coins,700);
  }
});

test('shop prices, coin+PIN gate and idempotent ownership; PIN change hashes and persists',async()=>{
  assert.ok(PARTS.filter(p=>p.price>0).length>=8);assert.equal(PARTS.filter(p=>p.legendary).length,3);
  const p=new Profile(memory());p.credit(2000);assert.equal(p.buy('crown'),'pin');assert.equal(p.coins,2000);
  assert.equal(await p.verifyPin('0000'),false);assert.equal(await p.verifyPin('0808'),true);
  assert.equal(p.buy('crown',true),'bought');assert.equal(p.coins,1500);assert.equal(p.buy('crown',true),'equipped');assert.equal(p.coins,1500);
  assert.equal(await p.setPin('2468'),true);assert.ok(p.data.parent.hash&&!JSON.stringify(p.data.parent).includes('2468'));
  const restored=new Profile(p.storage);assert.equal(await restored.verifyPin('0808'),false);assert.equal(await restored.verifyPin('2468'),true);assert.equal(restored.equipped.head,'crown');
  for(let i=0;i<5;i++)await restored.verifyPin('1111',1000);assert.equal(await restored.verifyPin('2468',2000),false);assert.equal(await restored.verifyPin('2468',32000),true);
});

test('unsupported haptics are harmless; toggle and rate limit suppress motor calls',()=>{
  const p=new Profile(null),calls=[],h=new Haptics(p,{vibrate:v=>calls.push(v)});h.play({type:'hit'},0);h.play({type:'hit'},10);h.play({type:'brake-win'},100);assert.equal(calls.length,2);p.setting('haptics');h.play({type:'explode',boss:true},200);assert.equal(calls.length,2);assert.doesNotThrow(()=>new Haptics(p,{}).play({type:'hit'}));
});

test('all four modes freeze with background time and persist purchases across mode changes',()=>{
  const profile=new Profile(memory()),app=new Arcade(profile);profile.credit(500);profile.buy('cat');
  for(const mode of ['stairs','battle','runner','plaza']){assert.equal(app.enter(mode),true);app.advance(100);app.setPaused(true);const before=JSON.stringify(app[mode].snapshot());app.advance(90000);assert.equal(JSON.stringify(app[mode].snapshot()),before);app.setPaused(false);app.advance(850);assert.equal(app.home(),true);assert.equal(profile.palette.parts.head,'cat');}
});


test('automatic combat saves commit only after all fixed ticks in a frame, including keyboard movement',()=>{
  const p=new Profile(memory()),b=new CampaignBattle(seeded(),p);b.setPaused(false);
  for(let frame=0;frame<800;frame++){
    b.setAxis(frame%80<40?-1:1);b.advance(frame%3===0?1000/90:50);b.takeEvents();
    const cp=p.data.progress.battle.checkpoint;
    assert.ok(cp.state.substepMs<CONFIG.engine.stepMs, 'No unfinished frame time may be serialized');
    if(frame%20===0){const restored=new CampaignBattle(seeded(),new Profile(p.storage));assert.equal(restored.recovered,false);}
  }
  const positions=[];for(const hz of [60,90,120]){const model=new Battle(seeded());model.setAxis(-1);for(let f=0;f<hz*.5;f++)model.advance(1000/hz);positions.push(model.state.x);}
  assert.deepEqual(positions,[positions[0],positions[0],positions[0]]);
});

test('twenty minutes of runner objects and twenty mission deliveries retain bounded pools and stable rewards',()=>{
  const p=new Profile(memory()),r=new Runner(p),plaza=new Plaza(p);r.setPaused(false);plaza.setPaused(false);
  const references=new Set(r.items.items);let peak=0;
  for(let t=0;t<20*60*1000;t+=50){
    const word=r.items.active.find(i=>i.kind==='word'&&i.sentence===r.state.sentence&&i.slot===r.state.slot&&i.x>210&&i.x<300);
    if(word&&r.state.y===0)r.press();if(r.state.y>0&&r.state.holdMs>=250)r.releaseJump();r.advance(50);r.takeEvents();peak=Math.max(peak,r.items.active.length);
    assert.ok(r.items.active.every(i=>references.has(i)));
  }
  assert.ok(r.state.completed>20);assert.ok(peak<=CONFIG.runner.itemLimit);
  const before=p.coins;
  for(let round=0;round<20;round++){
    if(plaza.state.phase==='success')plaza.start();plaza.start();
    for(const item of plaza.items.active)if(plaza.mission.some(m=>m.kind===item.kind))plaza.collect(item);
    plaza.state.x=0;plaza.state.z=3.15;plaza.advance(5);assert.equal(plaza.state.phase,'success');plaza.takeEvents();
    assert.equal(plaza.items.active.length+plaza.items.free.length,CONFIG.plaza.itemLimit);
  }
  assert.equal(p.coins-before,1000);assert.equal(p.data.stats.missionWins,20);
});

test('parent metrics exclude unattended gates and non-playing result/briefing time',()=>{
  const p=new Profile(memory()),app=new Arcade(p,seeded());app.enter('plaza');app.advance(1000);assert.equal(p.data.stats.playMs,0);app.plaza.start();app.advance(1000);assert.equal(p.data.stats.playMs,1000);
  const b=app.battle;b.setPaused(false);const gate=()=>({options:[{result:8,text:'4 + 4'},{result:5,text:'2 + 3'}],correct:0,spawnedAt:0,passed:false});
  b.state.x=-.5;b.passGate(gate());b.saveRun();assert.equal(p.data.stats.gates,0);
  b.state.elapsedMs=1200;b.state.lastSteerAt=200;b.state.lane=0;b.state.laneSince=200;b.passGate(gate());b.saveRun();assert.equal(p.data.stats.gates,1);assert.equal(p.data.stats.gateWins,1);
});

test('brake report counts only the red hold failure, not an ordinary direction mistake during yellow warning',()=>{
  const p=new Profile(memory()),g=new Game(()=>.5,{wallet:p});g.state.mode=MODE.BRAKE_WARNING;g.stumble(true);assert.equal(p.data.stats.brakes,0);g.state.mode=MODE.BRAKE_HOLD;g.stumble(true);assert.equal(p.data.stats.brakes,1);
});

test('cross-field corrupt adventure checkpoints cannot strand a word slot or remove required cargo',()=>{
  const p=new Profile(memory());p.credit(800);const r=new Runner(p);r.save();p.data.progress.runner.checkpoint.state.slot=3;p.save();assert.equal(new Runner(new Profile(p.storage)).recovered,true);
  const plaza=new Plaza(p);plaza.save();p.data.progress.plaza.checkpoint.items=[];p.save();const recovered=new Plaza(new Profile(p.storage));assert.equal(recovered.recovered,true);assert.equal(recovered.profile.coins,800);assert.ok(recovered.items.active.length>0);
});
