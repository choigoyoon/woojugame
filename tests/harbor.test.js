import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignBattle,validCheckpoint } from '../js/campaign.js';
import { Profile } from '../js/profile.js';
import { CONFIG, ACTION, MODE } from '../js/config.js';
import { Game } from '../js/game.js';
import { Runner } from '../js/runner.js';
import { Plaza, GOODS } from '../js/plaza.js';
import { SCENARIOS } from '../js/scenarios.js';
import { SENTENCES, SYMBOLS } from '../js/sentences.js';
import { trainParts } from '../js/harbor-art.js';
const create=()=>{const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},p=new Profile(storage),b=new CampaignBattle(()=>.42,p);b.setPaused(false);return{b,p,storage};};
const advance=(b,ms)=>{for(let t=0;t<ms;t+=25){b.advance(Math.min(25,ms-t));b.takeEvents();}};
function bossOnly(b){b.entities=[];b.bullets=[];b.gates=[];b.gateIndex=2;b.bossSpawned=true;b.harbor.state.cursor=CONFIG.harbor.events[b.state.round].length;b.spawn('boss',0,9,600);b.harbor.after();}

test('fork consumes both choices once; collect radius is forgiving but center does not auto-select',()=>{
  const {b}=create();b.entities=[];b.harbor.encounter('stock');const [crew,shield]=b.entities;
  const before=b.state.squad;b.state.x=.45;b.collectSupply(shield);assert.equal(b.harbor.state.shields,2);assert.equal(b.state.squad,before);assert.ok(crew.dead&&shield.dead);
  b.entities=[];b.harbor.encounter('stock');b.state.x=0;for(const e of b.entities)b.collectSupply(e);assert.equal(b.state.squad,before);assert.equal(b.harbor.state.shields,2);
});
test('supply is immune to shots and explosive cascades, and selected weapon persists',()=>{
  const {b,storage}=create();b.entities=[];b.harbor.encounter('armory');const target=b.entities[1];
  b.hit(target,999);assert.equal(target.hp,1);assert.equal(b.canHit(target),false);
  b.spawn('barrel',target.x,target.z,1,{explosive:true});b.hit(b.entities.at(-1),1);assert.equal(target.dead,false);
  b.state.x=.55;b.collectSupply(target);b.advance(5);assert.equal(b.state.weapon,'pierce');
  const resumed=new CampaignBattle(()=>.8,new Profile(storage));assert.equal(resumed.recovered,false);assert.equal(resumed.state.weapon,'pierce');assert.ok(!resumed.entities.some(e=>e.kind==='supply'));assert.equal(resumed.harbor.state.version,1);
});
test('shield absorbs one hit and invulnerability prevents overlapping objects charging twice',()=>{
  const {b}=create();b.harbor.state.shields=2;const crew=b.state.squad;
  assert.equal(b.hurt(2),false);assert.equal(b.harbor.state.shields,1);b.hurt(2);assert.equal(b.harbor.state.shields,1);
  b.harbor.before(1000);b.hurt(2);assert.equal(b.harbor.state.shields,0);assert.equal(b.state.squad,crew);
  b.harbor.before(1000);assert.equal(b.hurt(2),true);assert.equal(b.state.squad,crew-2);
});
test('all four weapons require aiming at both bolts; idle center cannot rescue a train',()=>{
  for(const weapon of Object.keys(CONFIG.campaign.weapons)){
    const {b}=create();b.state.weapon=weapon;b.state.squad=99;bossOnly(b);advance(b,90000);
    assert.equal(b.state.bosses,0,weapon);assert.equal(b.harbor.state.locksBroken,0,weapon);assert.equal(b.progress.harbor.rescued,0,weapon);
  }
});
test('bolts can be destroyed independently and an interrupted rescue reloads without rewarding twice',()=>{
  const {b,p,storage}=create();bossOnly(b);const lock=b.entities.find(e=>e.kind==='lock');b.hit(lock,999);b.advance(5);
  const coins=p.coins,restored=new CampaignBattle(()=>.2,new Profile(storage));assert.equal(restored.recovered,false);assert.equal(restored.harbor.state.locksBroken,1);assert.equal(restored.entities.filter(e=>e.kind==='lock').length,1);
  restored.setPaused(false);const second=restored.entities.find(e=>e.kind==='lock');restored.hit(second,999);restored.hit(second,999);restored.hit(restored.entities.find(e=>e.kind==='boss'),9999);advance(restored,2300);
  assert.equal(restored.state.phase,'result');assert.equal(restored.progress.harbor.rescued,1);assert.equal(restored.wallet.coins,coins+2+60+40);
  const again=new CampaignBattle(()=>.8,new Profile(storage));assert.equal(again.recovered,false);assert.equal(again.wallet.coins,restored.wallet.coins);assert.equal(again.progress.harbor.records[0].runs,1);
});
test('routes alter enemy formation, not HP; replay choices persist and only unlocked weapons can equip',()=>{
  const {b,storage}=create();b.entities=[];b.harbor.encounter('row');const row=b.entities.map(e=>({...e}));
  b.entities=[];b.harbor.state.route=1;b.harbor.encounter('row');assert.equal(new Set(b.entities.map(e=>e.x)).size,1);assert.equal(new Set(row.map(e=>e.x)).size,3);assert.deepEqual(row.map(e=>e.hp),b.entities.map(e=>e.hp));
  assert.equal(b.selectRoute(1),false);b.progress.round=2;b.progress.cleared=3;b.state.round=2;b.state.phase='complete';b.state.resultMs=1000;
  assert.equal(b.selectLoadout('arc'),false);b.progress.unlocked.pierce=2;assert.equal(b.selectLoadout('pierce'),true);assert.equal(b.selectRoute(1),true);
  const restored=new CampaignBattle(()=>.1,new Profile(storage));assert.equal(restored.recovered,false);restored.setPaused(false);assert.equal(restored.replay(),true);assert.equal(restored.harbor.state.route,1);assert.equal(restored.state.weapon,'pierce');assert.equal(restored.state.rank,2);
});
test('legacy v3 wallet and v1 combat checkpoint retain old director, projectiles and progress until safe boundary',()=>{
  const {b,p,storage}=create();b.legacyRun=true;b.resetRound();advance(b,12000);b.saveRun();
  const saved=p.snapshot();saved.version=3;saved.progress.battle.checkpoint.version=1;delete saved.progress.battle.checkpoint.mission;delete saved.progress.battle.harbor;
  storage.setItem(CONFIG.arcade.storageKey,JSON.stringify(saved));const p2=new Profile(storage),r=new CampaignBattle(()=>.9,p2);
  assert.equal(p2.data.version,4);assert.equal(r.recovered,false);assert.equal(r.harbor,null);assert.equal(r.rules.bossAtMs,120000);assert.deepEqual(r.entities,b.entities);assert.deepEqual(r.bullets,b.bullets);assert.equal(p2.coins,p.coins);
  const twice=new CampaignBattle(()=>.1,new Profile(storage));assert.equal(twice.harbor,null);assert.equal(twice.recovered,false);assert.equal(twice.state.waveMs,b.state.waveMs);
  twice.setPaused(false);twice.finishWave();advance(twice,1000);assert.equal(twice.choose(0),true);assert.ok(twice.harbor);assert.equal(twice.rules.bossAtMs,95000);
});
test('invalid mission state recovers the run without losing coins or permanent rescue',()=>{
  const {b,p,storage}=create();p.credit(124);b.progress.harbor.rescued=1;b.saveRun();const saved=p.snapshot();saved.progress.battle.checkpoint.mission.shields=100;
  storage.setItem(CONFIG.arcade.storageKey,JSON.stringify(saved));const restored=new CampaignBattle(()=>.9,new Profile(storage));assert.equal(restored.recovered,true);assert.equal(restored.wallet.coins,124);assert.equal(restored.progress.harbor.rescued,1);
});
test('medals are optional route-specific records and repeated completion cannot duplicate first rewards',()=>{
  const {b}=create();b.harbor.state.chain=4;b.harbor.state.cargo=2;b.state.bossAttacks=1;b.state.roundMs=100000;b.finishWave();b.saveRun();
  assert.deepEqual(b.progress.harbor.records[0],{runs:1,bestMs:100000,medals:7});const coins=b.wallet.coins;b.finishWave();assert.equal(b.wallet.coins,coins);
  assert.equal(b.progress.harbor.records[3],null);assert.equal(b.progress.harbor.rescued,1);
});
test('new support gates never silently select the larger answer at the lane seam',()=>{
  const {b}=create();const gate={...b.createGate(),passed:false};assert.equal(gate.options[0].result,3);assert.equal(gate.options[1].result,5);
  const crew=b.state.squad;b.passGate(gate);assert.equal(b.state.squad,crew+3);assert.equal(b.state.gateResult.good,false);assert.equal(b.progress.skill.samples.length,0);
});
test('checkpoint remains valid with an in-flight fork and partial lock damage',()=>{
  const {b}=create();b.entities=[];b.harbor.encounter('stock');assert.ok(validCheckpoint(b.checkpoint(),b.state,b.progress));
  bossOnly(b);b.hit(b.entities.find(e=>e.kind==='lock'),1);assert.ok(validCheckpoint(b.checkpoint(),b.state,b.progress));
});

test('spread can hit separate columns while pierce reaches the second enemy in a line',()=>{
  const volley=(weapon,positions,x)=>{const {b}=create();b.entities=[];b.bullets=[];b.state.weapon=weapon;b.state.x=b.state.targetX=x;b.state.shotClock=100000;
    positions.forEach(([px,z])=>b.spawn('enemy',px,z,100));b.shoot();advance(b,220);return b.entities.filter(e=>e.hp<100).length;};
  assert.equal(volley('pulse',[[-.64,7],[0,7],[.64,7]],.2),1);
  assert.equal(volley('spread',[[-.64,7],[0,7],[.64,7]],.2),2);
  assert.equal(volley('pulse',[[.52,4],[.52,6],[.52,8]],.52),1);
  assert.equal(volley('pierce',[[.52,4],[.52,6],[.52,8]],.52),2);
});

test('the alternate cargo route is fully playable across all three rounds and keeps separate best records',()=>{
  const {b}=create();b.progress.cleared=3;b.state.phase='complete';b.state.resultMs=1000;b.selectRoute(1);assert.equal(b.replay(),true);
  for(let round=0;round<3;round++){
    for(let t=0;t<180000&&b.state.phase==='combat';t+=100){
      const a=b.state.attack,gate=b.gates[0],near=[...b.entities].sort((a,c)=>a.z-c.z)[0];
      b.steer(a?.phase==='warning'?(a.lane===1?-.7:.7):gate&&gate.z<14?(gate.correct===0?-.55:.55):near?.x??0);b.advance(100);b.takeEvents();
    }
    assert.equal(b.state.phase,round===2?'complete':'result');assert.ok(b.progress.harbor.records[3+round]);assert.equal(b.progress.harbor.records[round],null);
    assert.equal(b.state.firstReward,0);assert.equal(b.state.roundGates,2);advance(b,900);if(round<2)assert.equal(b.choose(1),true);
  }
  assert.equal(b.progress.harbor.rescued,7);
});

 test('a corrupted bolt count cannot make a saved boss impossible to finish',()=>{
  const {b}=create();bossOnly(b);const cp=b.checkpoint();cp.entities=cp.entities.filter(e=>e.kind!=='lock');assert.equal(validCheckpoint(cp,b.state,b.progress),false);
  const cp2=b.checkpoint();cp2.mission.locksSpawned=false;assert.equal(validCheckpoint(cp2,b.state,b.progress),false);
});

test('train assembly requires all four modes: brake alone does not clear lighthouse, and battle 3/3 alone is not complete',()=>{
  const {b,p,storage}=create();
  assert.equal(trainParts(p.data).doneCount,0);assert.equal(trainParts(p.data).complete,false);
  // Battle 3/3 alone unlocks locomotive and harbor cars, but only 1/4 operations (not complete).
  b.progress.cleared=3;b.progress.harbor.rescued=7;b.saveRun();
  let parts=trainParts(new Profile(storage).data);
  assert.equal(parts.loco,true);assert.equal(parts.harborCars,2);assert.equal(parts.doneCount,1);assert.equal(parts.complete,false);
  // A stair brake win alone must NOT mark the lighthouse beacon mission as cleared.
  const stairs=new Game(()=>0,{wallet:p});
  for(let i=0;i<15;i++){if(stairs.state.facing!==stairs.nextDirection)stairs.act(ACTION.TURN);stairs.act(ACTION.CLIMB);}
  assert.equal(stairs.state.mode,MODE.BRAKE_WARNING);stairs.advance(2500);
  assert.equal(p.data.stats.brakeWins,1);assert.equal(p.data.progress.stairs.cleared,0);assert.equal(trainParts(p.data).beacon,false);
  // Solving the 50-step bridge puzzle persists stairs.cleared and unlocks the lighthouse beacon (2/4).
  while(stairs.state.step<50){
    if(stairs.state.mode===MODE.PLAYING){if(stairs.state.facing!==stairs.nextDirection)stairs.act(ACTION.TURN);stairs.act(ACTION.CLIMB);}
    else stairs.advance(500);
  }
  assert.equal(stairs.state.mode,MODE.PUZZLE);
  const answerIndex=stairs.state.puzzle.choices.indexOf(SCENARIOS[0].answer);
  assert.equal(stairs.choose(answerIndex).type,'puzzle-win');
  parts=trainParts(new Profile(storage).data);
  assert.equal(parts.stairsCleared,1);assert.equal(parts.beacon,true);assert.equal(parts.doneCount,2);assert.equal(parts.complete,false);
  // Runner 3-word capture persists runner.cleared and unlocks the booster coach (3/4).
  const runner=new Runner(p);runner.setPaused(false);
  for(let slot=0;slot<3;slot++){const w=runner.spawn('word',{slot,sentence:0});runner.hitWord(w);runner.items.prune(i=>!i.dead);}
  runner.save();parts=trainParts(new Profile(storage).data);
  assert.equal(parts.coach,true);assert.equal(parts.doneCount,3);assert.equal(parts.complete,false);
  // Plaza cargo delivery persists plaza.cleared and unlocks the engine core reactor, completing 4/4 assembly.
  const plaza=new Plaza(p);plaza.setPaused(false);plaza.start();
  for(const item of plaza.items.active)if(plaza.mission.some(m=>m.kind===item.kind))plaza.collect(item);
  plaza.state.x=0;plaza.state.z=3.15;plaza.advance(5);
  parts=trainParts(new Profile(storage).data);
  assert.equal(parts.reactor,true);assert.equal(parts.doneCount,4);assert.equal(parts.complete,true);
});

test('all four modes use Sky Harbor rescue narratives, valid symbol mappings, and Coco tactical feedback without classroom moralizing',()=>{
  const banned=/선생님|칠판|수업 종|복도로|만화책|게임기|폭탄/;
  for(const s of SCENARIOS){
    assert.ok(!banned.test(s.speech),s.speech);
    for(const label of s.labels)assert.ok(!banned.test(label),label);
  }
  for(const g of Object.values(GOODS))assert.ok(!banned.test(g.name),g.name);
  const plaza=new Plaza(new Profile(null));
  assert.ok(!banned.test(plaza.speech),plaza.speech);
  for(const s of SENTENCES){
    assert.ok(SYMBOLS[s[3]],`missing subject symbol ${s[3]}`);
    assert.ok(SYMBOLS[s[4]],`missing object symbol ${s[4]}`);
  }
  const runner=new Runner(new Profile(null));runner.setPaused(false);
  const wrong=runner.spawn('word',{slot:1,sentence:0});
  runner.hitWord(wrong);
  assert.ok(runner.state.message.includes('코코:'),runner.state.message);
  assert.ok(runner.state.spawnMs<=750);
});
