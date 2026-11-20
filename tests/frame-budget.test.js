import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameClock } from '../js/arcade.js';
import { Battle } from '../js/battle.js';
import { FrameBudget, FramePacer } from '../js/frame-budget.js';

function drive(b,seconds,hz,cost,now=0,jitter=()=>0){
  const end=now+seconds*1000;let i=0;
  while(now<end){now+=1000/hz+jitter(i++);b.sample(now,cost);}
  return now;
}
for(const hz of [60,90,120,144,240])test(`${hz}Hz timing samples remain valid at low workload`,()=>{
  const b=new FrameBudget();drive(b,20,hz,2);
  assert.equal(b.scale,1);assert.equal(b.changes,0);assert.ok(Math.abs(b.snapshot().fps-hz)<.01);
});
test('sustained overload reduces pixels, then recovers gradually after sustained headroom',()=>{
  const b=new FrameBudget();let now=drive(b,12,60,15);
  assert.equal(b.scale,.75);assert.equal(b.changes,2);
  now=drive(b,5,120,1,now);assert.equal(b.scale,.75);
  now=drive(b,16,120,1,now);assert.equal(b.scale,.875);
  drive(b,20,120,1,now);assert.equal(b.scale,1);assert.equal(b.changes,4);
});
test('a single spike and scene warmup do not drop quality',()=>{
  const b=new FrameBudget();let now=drive(b,1,120,100);
  now=drive(b,5,120,1,now);now=drive(b,.5,120,100,now);drive(b,5,120,1,now);
  assert.equal(b.scale,1);assert.equal(b.changes,0);
});
test('irregular missed vsyncs trigger adaptation even with low JS submit cost',()=>{
  const b=new FrameBudget();drive(b,12,60,1,0,i=>i%3===0?1000/60:0);assert.equal(b.scale,.75);
});
test('stable Android battery throttling alone does not blur the canvas',()=>{
  const b=new FrameBudget();drive(b,20,30,1);assert.equal(b.scale,1);assert.ok(Math.abs(b.snapshot().fps-30)<.01);
});
test('background gaps, backwards clocks, and invalid samples do not poison cadence',()=>{
  const b=new FrameBudget();let now=drive(b,3,90,2);b.sample(NaN,2);b.sample(now-10,2);b.sample(now,NaN);
  now+=60000;b.sample(now,100);drive(b,6,90,2,now);
  assert.equal(b.scale,1);assert.ok(Math.abs(b.snapshot().fps-90)<.01);
});
test('scene changes reset startup pressure without undoing the selected quality',()=>{
  const b=new FrameBudget();const now=drive(b,12,60,15);assert.equal(b.scale,.75);
  b.reset(now);drive(b,1,60,100,now);assert.equal(b.scale,.75);assert.equal(b.changes,2);
});

for(const hz of [30,59.94,60,61,90,120,144,240])test(`${hz}Hz RAF renders at most 60fps without false quality reduction`,()=>{
  const p=new FramePacer(),b=new FrameBudget(),times=[];
  for(let i=0;i<hz*10;i++){const now=i*1000/hz;if(p.due(now)){times.push(now);b.sample(now,hz===30?2:8);}}
  assert.ok(Math.abs(times.length-Math.min(hz,60)*10)<=1,String(times.length));
  assert.equal(b.scale,1);
  assert.ok(Math.max(...times.slice(1).map((t,i)=>t-times[i]))<=1000/hz+1000/60+.5);
});
test('60Hz timestamp jitter does not repeatedly halve output',()=>{
  const p=new FramePacer();let frames=0;
  for(let i=0;i<600;i++)if(p.due(i*1000/60+(i%2?.08:-.08)))frames++;
  assert.equal(frames,600);
});
test('a stall does not cause catch-up draws; resume and backwards clocks restart promptly',()=>{
  const p=new FramePacer();assert.equal(p.due(0),true);assert.equal(p.due(8),false);
  assert.equal(p.due(1000),true);assert.equal(p.due(1001),false);
  p.reset();assert.equal(p.due(5000),true);assert.equal(p.due(4),true);assert.equal(p.due(NaN),false);
});

test('60fps pacing preserves elapsed combat time and fire rate on 60/90/120Hz displays',()=>{
  const runs=[];
  for(const hz of [60,90,120]){
    const clock=new FrameClock(),pacer=new FramePacer(),game=new Battle(()=>.5);
    for(let i=0;i<=hz*10;i++){const now=i*1000/hz;if(pacer.due(now)){game.advance(clock.tick(now));game.takeEvents();}}
    runs.push({distance:game.state.distance,shots:game.state.shots,kills:game.state.kills,coins:game.state.coins,elapsed:game.state.elapsedMs});
  }
  assert.equal(runs[0].elapsed,10000);assert.ok(runs[0].shots>0);
  assert.deepEqual(runs[1],runs[0]);assert.deepEqual(runs[2],runs[0]);
});

test('native refresh phase drift never inserts needless skipped frames',()=>{
  const p=new FramePacer();let now=0,count=0;
  for(let i=0;i<3600;i++){now+=16.6+(i%2?.13:0);if(p.due(now))count++;}
  assert.equal(count,3600);
});
