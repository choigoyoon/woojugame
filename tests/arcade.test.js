import test from 'node:test';
import assert from 'node:assert/strict';
import { Profile, BASE_AVATAR } from '../js/profile.js';
import { Arcade, FrameClock } from '../js/arcade.js';
import { Game } from '../js/game.js';
import { ACTION, CONFIG, MODE } from '../js/config.js';
import { SCENARIOS } from '../js/scenarios.js';

const memory=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
test('interleaved input and older RAF timestamps do not count an interval twice',()=>{
  const clock=new FrameClock(1000);
  const intervals=[1010,1020,1016,1030].map(time=>clock.tick(time));
  assert.deepEqual(intervals,[10,10,0,10]);assert.equal(intervals.reduce((a,b)=>a+b),30);
  assert.equal(clock.tick(NaN),0);clock.reset(9000);assert.equal(clock.tick(9016),16);
});
function climb(g){if(g.state.facing!==g.nextDirection)g.act(ACTION.TURN);return g.act(ACTION.CLIMB);}
function reach(step){const g=new Game(()=>.5,{events:false});while(g.state.step<step)climb(g);g.eventsEnabled=true;return g;}

test('shared wallet survives reload, validates bad data, and exposes copies of equipment',()=>{
  const store=memory(),p=new Profile(store);p.credit(71);p.credit(0);p.credit(-5);p.credit(Infinity);
  p.equipped.head='corrupt';const again=new Profile(store);
  assert.equal(again.coins,71);assert.deepEqual(again.equipped,BASE_AVATAR);
  store.setItem(CONFIG.arcade.storageKey,'broken');const recovered=new Profile(store);assert.equal(recovered.coins,71);assert.equal(recovered.status,'recovered');
  recovered.credit(7);assert.equal(new Profile(store).coins,78);
  store.setItem(CONFIG.arcade.storageKey,JSON.stringify({version:1,coins:-12,equipped:{head:'unknown'},owned:null}));
  assert.equal(new Profile(store).coins,78);assert.deepEqual(new Profile(store).equipped,BASE_AVATAR);
});
test('storage denial or quota exhaustion never blocks coin rewards',()=>{
  const profile=new Profile({getItem(){throw Error('denied');},setItem(){throw Error('quota');}});
  profile.credit(50);assert.equal(profile.coins,50);assert.equal(profile.status,'memory');
  assert.equal(profile.save(),false);
});
test('home waits 800ms plus release; inactive modes freeze and both games credit the same wallet',()=>{
  const p=new Profile(memory()),app=new Arcade(p,()=>.5);
  assert.equal(app.mode,'lobby');assert.equal(app.enter('unknown'),false);assert.equal(app.enter('stairs'),true);
  climb(app.stairs);app.interact();app.advance(799);assert.equal(app.home(),false);
  app.advance(1);assert.equal(app.home(true),false);assert.equal(app.home(),true);
  const time=app.stairs.state.elapsedMs;app.advance(1000);assert.equal(app.stairs.state.elapsedMs,time);
  assert.equal(app.enter('battle'),true);const barrel=app.battle.entities[0];app.battle.hit(barrel,barrel.hp);
  app.advance(1); // Commit the combat transaction at the simulation boundary.
  const coins=1+CONFIG.battle.barrelCoins+2*CONFIG.battle.enemyCoins;
  assert.equal(p.coins,coins);app.advance(800);assert.equal(app.home(),true);assert.equal(app.enter('stairs'),true);
  assert.equal(app.stairs.state.step,1);assert.equal(app.stairs.wallet.coins,coins);
  app.setPaused(true);const clock=app.clock;app.advance(9000);assert.equal(app.clock,clock);
  assert.equal(new Profile(p.storage).coins,coins);
});
test('brake warning permits input until exactly 500ms; hold input fails without coin loss',()=>{
  const g=new Game(()=>0);for(let i=0;i<15;i++)climb(g);
  assert.equal(g.state.mode,MODE.BRAKE_WARNING);g.advance(499);
  assert.equal(g.act(ACTION.TURN).type,'turn');g.advance(1);assert.equal(g.state.mode,MODE.BRAKE_HOLD);
  const before={coins:g.state.coins,step:g.state.step};assert.equal(g.act(ACTION.CLIMB).type,'stumble');
  assert.equal(g.state.coins,before.coins);assert.equal(g.state.step,before.step);assert.equal(g.state.combo,0);
  g.advance(999);assert.equal(g.state.mode,MODE.STUMBLE);g.advance(1);assert.equal(g.state.mode,MODE.PLAYING);
});
test('brake success pays once and five automatic steps preserve combo without ordinary rewards',()=>{
  const g=new Game(()=>0);for(let i=0;i<15;i++)climb(g);const coins=g.state.coins;
  g.advance(500);g.advance(1999);assert.equal(g.state.mode,MODE.BRAKE_HOLD);assert.equal(g.state.coins,coins);
  g.advance(1);assert.equal(g.state.mode,MODE.AUTO_CLIMB);assert.equal(g.state.coins,coins+15);
  assert.equal(g.act(ACTION.CLIMB),null);g.advance(CONFIG.brake.autoStepMs*6);
  assert.equal(g.state.step,20);assert.equal(g.state.combo,15);assert.equal(g.state.coins,coins+15);assert.equal(g.state.mode,MODE.PLAYING);
  assert.equal(g.takeEvents().filter(e=>e.type==='brake-win').length,1);
});
test('background or lobby return restarts brake warning and never consumes hidden time',()=>{
  const g=new Game(()=>0);for(let i=0;i<15;i++)climb(g);g.advance(1200);
  g.setPaused(true);const remaining=g.state.brakeRemainingMs;g.advance(90000);assert.equal(g.state.brakeRemainingMs,remaining);
  g.setPaused(false);assert.equal(g.state.mode,MODE.BRAKE_WARNING);assert.equal(g.state.brakeRemainingMs,500);
});
test('48 -> 53 auto climb opens the 50-step puzzle after final landing, exactly once',()=>{
  const g=reach(48);g.state.mode=MODE.BRAKE_HOLD;g.state.brakeRemainingMs=1;
  g.advance(1+CONFIG.brake.autoStepMs*5);assert.equal(g.state.step,53);assert.equal(g.state.mode,MODE.AUTO_CLIMB);
  g.advance(CONFIG.brake.autoStepMs);assert.equal(g.state.mode,MODE.PUZZLE);
  assert.equal(g.takeEvents().filter(e=>e.type==='puzzle').length,1);
  const p=g.state.puzzle,index=p.choices.indexOf(SCENARIOS[0].answer),coins=g.state.coins;
  assert.equal(g.choose(index).type,'puzzle-win');assert.equal(g.choose(index),null);assert.equal(g.state.coins,coins+50);
  g.advance(1800);assert.equal(g.state.mode,MODE.PLAYING);assert.equal(g.state.nextPuzzle,100);assert.equal(g.state.step,53);
});
test('50-step puzzle preempts warning; no new brake reservation in the preceding three steps',()=>{
  const g=reach(46);g.state.nextBrake=47;
  for(const step of[47,48,49]){climb(g);assert.equal(g.state.step,step);assert.equal(g.state.mode,MODE.PLAYING);g.scheduleBrake();assert.equal(g.state.nextBrake,null);}
  g.state.mode=MODE.BRAKE_WARNING;g.state.brakeRemainingMs=500;climb(g);assert.equal(g.state.mode,MODE.PUZZLE);
});
test('all four picture puzzles allow retry, shuffle choices, and reward only once',()=>{
  for(let n=0;n<SCENARIOS.length;n++){
    const g=reach((n+1)*50-1);g.state.nextPuzzle=(n+1)*50;climb(g);
    const p=g.state.puzzle;assert.equal(p.id,SCENARIOS[n].id);const correct=p.choices.indexOf(SCENARIOS[n].answer),coins=g.state.coins;
    assert.equal(g.choose(1-correct).type,'puzzle-miss');assert.equal(g.state.coins,coins);assert.equal(g.state.mode,MODE.PUZZLE);
    assert.equal(g.choose(correct).type,'puzzle-win');assert.equal(g.choose(correct),null);assert.equal(g.state.coins,coins+50);
  }
});
