import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameBudget } from '../js/frame-budget.js';

function drive(b,seconds,hz,cost,now=0,jitter=()=>0){
  const end=now+seconds*1000;let i=0;
  while(now<end){now+=1000/hz+jitter(i++);b.sample(now,cost);}
  return now;
}
for(const hz of [60,90,120,144,240])test(`${hz}Hz keeps full resolution without a frame limiter`,()=>{
  const b=new FrameBudget();drive(b,20,hz,2);
  assert.equal(b.scale,1);assert.equal(b.changes,0);assert.ok(Math.abs(b.snapshot().fps-hz)<.01);
});
test('sustained overload reduces pixels, then recovers gradually after sustained headroom',()=>{
  const b=new FrameBudget();let now=drive(b,12,120,8);
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
  const b=new FrameBudget();drive(b,12,120,1,0,i=>i%3===0?1000/120:0);assert.equal(b.scale,.75);
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
