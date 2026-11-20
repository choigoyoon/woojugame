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
test('passing a gate adds the exact larger result once; smaller and negative choices never eliminate the squad',()=>{
  const b=new Battle(seeded()),gate={...makeGate(()=>.8,true),z:1.9};
  b.state.x=gate.correct===0?-.5:.5;const count=b.state.squad;
  b.passGate(gate);assert.equal(b.state.squad,count+gate.options[gate.correct].result);
  const total=b.state.squad,coins=b.state.coins;b.passGate(gate);assert.equal(b.state.squad,total);assert.equal(b.state.coins,coins);
  for(let i=0;i<30;i++){const bad={...makeGate(()=>.3),passed:false};b.state.x=bad.correct===0?.5:-.5;b.passGate(bad);}
  assert.equal(b.state.squad,1);assert.equal(b.state.coins,coins);
});

test('a smaller gate only removes one member from the starting five, and at most three from a large squad',()=>{
  const b=new Battle(),bad=()=>({...makeGate(()=>.3),passed:false});
  let gate=bad();b.state.x=gate.correct===0?.5:-.5;b.passGate(gate);assert.equal(b.state.squad,4);
  b.state.squad=100;gate=bad();b.state.x=gate.correct===0?.5:-.5;b.passGate(gate);assert.equal(b.state.squad,97);
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
