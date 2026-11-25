import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, makeGate } from '../js/battle.js';
import { CONFIG } from '../js/config.js';
const seeded=()=>{let seed=17;return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);};

test('2,000 generated gates use exact arithmetic, unequal results, and independent position/color',()=>{
  const random=seeded();const combinations=new Set();let negatives=0;
  for(let i=0;i<2000;i++){
    const gate=makeGate(random);
    assert.notEqual(gate.options[0].result,gate.options[1].result);
    for(const o of gate.options){assert.equal(o.result,o.op==='+'?o.a+o.b:o.a-o.b);assert.ok(o.a>=0&&o.a<=20&&o.b>=0&&o.b<=20);if(o.result<0)negatives++;}
    assert.ok(gate.options[gate.correct].result>gate.options[1-gate.correct].result);
    combinations.add(gate.correct+':'+gate.blueSide);
  }
  assert.equal(combinations.size,4);assert.ok(negatives>0);
});
test('either positive gate adds its displayed result and coins exactly once',()=>{
  const b=new Battle(seeded()),gate={...makeGate(()=>.8,true),z:1.9};
  b.state.x=gate.correct===0?-.5:.5;const count=b.state.squad;
  b.passGate(gate);assert.equal(b.state.squad,count+gate.options[gate.correct].result);
  const total=b.state.squad,coins=b.state.coins;b.passGate(gate);assert.equal(b.state.squad,total);assert.equal(b.state.coins,coins);
  const smaller={...makeGate(()=>.3),passed:false},index=1-smaller.correct,result=smaller.options[index].result;
  assert.ok(result>0);b.state.x=index===0?-.5:.5;b.passGate(smaller);
  assert.equal(b.state.squad,total+result);assert.equal(b.state.coins,coins+CONFIG.battle.gateCoins);
  assert.equal(b.state.gateResult.good,false);assert.equal(b.state.gateResult.change,result);
  b.passGate(smaller);assert.equal(b.state.squad,total+result);assert.equal(b.state.coins,coins+CONFIG.battle.gateCoins);
});

test('negative gates use a small penalty and never eliminate the last member',()=>{
  const b=new Battle(),negative=()=>({passed:false,correct:1,options:[{a:2,b:5,op:'−',result:-3},{result:8}]});
  b.state.x=-.5;b.passGate(negative());assert.equal(b.state.squad,4);
  b.state.squad=100;b.passGate(negative());assert.equal(b.state.squad,97);
  for(let i=0;i<100;i++)b.passGate(negative());
  assert.equal(b.state.squad,1);assert.equal(b.state.coins,0);
});
test('relative swept collision consumes one bullet at the nearest barrel even during a long frame',()=>{
  const b=new Battle();b.entities=[];b.bullets=[];b.state.shotClock=10000;
  b.spawn('barrel',0,4,10);b.spawn('barrel',0,6,10);
  b.bullets.push({id:999,x:0,z:2,damage:10});b.advance(250);
  assert.equal(b.state.kills,1);assert.equal(b.state.coins,5);assert.equal(b.entities.length,1);assert.equal(b.entities[0].hp,10);assert.equal(b.bullets.length,0);
});
test('growing a squad increases firepower with bounded pellets and damage',()=>{
  const small=new Battle(),large=new Battle();large.state.squad=1000;small.shoot();large.shoot();
  assert.ok(large.bullets.length>small.bullets.length);assert.ok(large.bullets[0].damage>small.bullets[0].damage);
  assert.ok(large.bullets.length<=CONFIG.battle.maxPellets);assert.ok(large.bullets[0].damage<=CONFIG.battle.maxDamage);
});
test('boss rewards exactly once, advances the wave, and paused time does not progress combat',()=>{
  const b=new Battle();b.entities=[];b.spawn('boss',0,9,150);const boss=b.entities[0];b.hit(boss,200);b.hit(boss,200);
  assert.equal(b.state.bosses,1);assert.equal(b.state.coins,60);
  b.setPaused(true);b.advance(20000);assert.equal(b.state.clearingMs,2200);
  b.setPaused(false);for(let i=0;i<11;i++)b.advance(200);
  assert.equal(b.state.wave,2);assert.equal(b.state.bosses,1);assert.equal(b.state.squad,5);
});
test('20 simulated minutes keep entities, bullets and event queues bounded while progressing through bosses',()=>{
  const b=new Battle(seeded());let peakEntities=0,peakBullets=0;
  for(let i=0;i<24000;i++){
    const gate=b.gates[0];if(gate)b.steer(gate.correct===0?-.55:.55);
    b.advance(50);b.takeEvents();peakEntities=Math.max(peakEntities,b.entities.length);peakBullets=Math.max(peakBullets,b.bullets.length);
    assert.ok(b.entities.length<=CONFIG.battle.maxEntities);assert.ok(b.bullets.length<=CONFIG.battle.maxBullets);assert.ok(b.gates.length<=2);assert.ok(b.state.squad>=1);
  }
  assert.ok(b.state.bosses>5);assert.ok(b.state.coins>300);assert.ok(peakBullets>0&&peakEntities>0);
  b.steer(Infinity);assert.ok(Number.isFinite(b.state.targetX));
});

test('hits expose progressive shell damage and explosive cascades pay each target once',()=>{
  const b=new Battle();b.entities=[];b.takeEvents();
  b.spawn('barrel',0,10,30,{explosive:true});b.spawn('barrel',.4,11,30,{explosive:true});b.spawn('enemy',-.4,12,12);
  b.spawn('enemy',0,20,12);
  const source=b.entities[0];b.hit(source,11);assert.equal(source.crack,1);b.hit(source,10);assert.equal(source.crack,2);
  assert.equal(b.state.kills,0);b.hit(source,9);b.hit(source,100);
  assert.equal(b.state.kills,3);assert.equal(b.state.coins,12);assert.equal(b.entities[3].hp,12);
  const events=b.takeEvents();assert.equal(events.filter(e=>e.type==='armor-break').length,2);
  assert.equal(events.filter(e=>e.type==='explode').length,3);assert.ok(events.some(e=>e.type==='hit'&&e.chain));
});

test('shooting a supply crate changes the weapon, pauses its timer, and returns to normal fire',()=>{
  const b=new Battle();b.entities=[];b.spawn('crate',0,12,CONFIG.battle.supplyHp);
  const normal=b.firepower();b.hit(b.entities[0],100);assert.equal(b.state.powerStarts,1);
  const power=b.firepower();assert.ok(power.pellets>normal.pellets&&power.damage>normal.damage&&power.interval<normal.interval);
  b.hit(b.entities[0],100);assert.equal(b.state.powerStarts,1);assert.equal(b.state.coins,CONFIG.battle.supplyCoins);
  b.setPaused(true);b.advance(20000);assert.equal(b.state.powerMs,CONFIG.battle.powerMs);
  b.setPaused(false);b.state.clearingMs=20000;
  for(let i=0;i<CONFIG.battle.powerMs/100;i++)b.advance(100);
  assert.equal(b.state.powerMs,0);assert.deepEqual(b.firepower(),normal);
});

test('four ordinary destructions trigger a bounded burst without extending it on every kill',()=>{
  const b=new Battle();b.entities=[];
  for(let i=0;i<CONFIG.battle.chargeKills;i++){b.spawn('enemy',0,20,1);b.hit(b.entities.at(-1),1);}
  assert.equal(b.state.powerStarts,1);assert.equal(b.state.charge,0);
  b.state.powerMs=1000;b.spawn('enemy',0,20,1);b.hit(b.entities.at(-1),1);
  assert.equal(b.state.powerMs,1000);assert.equal(b.state.powerStarts,1);
});

test('boss locks the warning lane, allows a dodge, and applies one small slam penalty',()=>{
  const b=new Battle();b.entities=[];b.spawn('boss',0,9,1000);
  b.state.x=-.5;b.updateBoss(CONFIG.battle.bossFirstAttackMs);assert.equal(b.state.attack.lane,0);
  b.state.x=.5;b.updateBoss(CONFIG.battle.bossWarningMs-1);assert.equal(b.state.bossAttacks,0);
  b.updateBoss(1);assert.equal(b.state.dodges,1);assert.equal(b.state.squad,5);
  b.updateBoss(CONFIG.battle.bossSlamMs);assert.equal(b.state.attack,null);
  b.updateBoss(CONFIG.battle.bossAttackGapMs);assert.equal(b.state.attack.lane,1);
  b.updateBoss(500);b.setPaused(true);b.setPaused(false);assert.equal(b.state.attack.remainingMs,CONFIG.battle.bossWarningMs);
  b.updateBoss(CONFIG.battle.bossWarningMs);assert.equal(b.state.squad,3);assert.equal(b.state.bossHits,1);
  b.updateBoss(20);assert.equal(b.state.squad,3);
  b.state.squad=1;b.updateBoss(CONFIG.battle.bossSlamMs);b.updateBoss(CONFIG.battle.bossAttackGapMs);b.updateBoss(CONFIG.battle.bossWarningMs);
  assert.equal(b.state.squad,1);
  b.hit(b.entities[0],600);assert.equal(b.entities[0].rage,true);assert.ok(b.takeEvents().some(e=>e.type==='boss-rage'));
  b.hit(b.entities[0],1000);assert.equal(b.state.attack,null);
});

test('encounters alternate between a row, an explosive convoy, and moving enemies',()=>{
  const b=new Battle();b.entities=[];b.spawnFormation();assert.equal(b.entities.length,3);
  assert.equal(new Set(b.entities.map(e=>e.x)).size,3);
  b.entities=[];b.spawnFormation();assert.ok(b.entities.some(e=>e.explosive));
  b.entities=[];b.spawnFormation();assert.equal(b.entities.filter(e=>e.weave).length,2);
});
