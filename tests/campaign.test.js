import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignBattle, campaignGate, nextDifficulty, validCheckpoint } from '../js/campaign.js';
import { Profile, BASE_AVATAR } from '../js/profile.js';
import { CONFIG } from '../js/config.js';

const memory=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const create=()=>{const storage=memory(),profile=new Profile(storage),battle=new CampaignBattle(()=>.42,profile);battle.setPaused(false);return{storage,profile,battle};};
const wait=(b,ms)=>{for(let left=ms;left>0;left-=100)b.advance(Math.min(left,100));};
function play(b,until=180000) {
  let spent=0;
  while(b.state.phase==='combat'&&spent<until){
    const gate=b.gates[0],attack=b.state.attack;
    const supply=b.entities.find(e=>e.kind==='crate');const near=[...b.entities].sort((a,c)=>a.z-c.z)[0];
    b.steer(attack?.phase==='warning'?(attack.lane===0?.65:attack.lane===1?-.65:.65):gate&&gate.z<14?(gate.correct===0?-.55:.55):(supply??near)?.x??0);
    b.advance(100);b.takeEvents();spent+=100;
  }
  return spent;
}

test('v1 wallet migrates without losing coins or equipped parts; progress copies do not leak',()=>{
  const storage=memory();storage.setItem(CONFIG.arcade.storageKey,JSON.stringify({version:1,coins:817,equipped:BASE_AVATAR,owned:Object.values(BASE_AVATAR)}));
  const p=new Profile(storage),b=new CampaignBattle(()=>.2,p);assert.equal(p.coins,817);assert.deepEqual(p.equipped,BASE_AVATAR);
  assert.equal(p.data.version,CONFIG.arcade.storageVersion);assert.equal(b.state.round,0);
  const copy=p.snapshot();copy.progress.battle.cleared=3;assert.equal(p.data.progress.battle.cleared,0);
  assert.equal(new Profile(storage).coins,817);
});

test('a saved combat checkpoint restores bullets, enemies, gate schedule, random state and wallet',()=>{
  const {storage,profile,battle:b}=create();play(b,31200);b.setPaused(true);
  const cp=b.checkpoint(),coins=profile.coins;
  assert.ok(validCheckpoint(cp,b.state,b.progress));
  const p2=new Profile(storage),restored=new CampaignBattle(()=>.99,p2);
  assert.equal(restored.recovered,false);assert.equal(restored.state.waveMs,b.state.waveMs);assert.equal(restored.seed,b.seed);
  assert.deepEqual(restored.entities,b.entities);assert.deepEqual(restored.bullets,b.bullets);assert.deepEqual(restored.gates,b.gates);
  assert.equal(restored.nextEnemy,b.nextEnemy);assert.equal(p2.coins,coins);
  b.setPaused(false);restored.setPaused(false);b.steer(0);restored.steer(0);wait(b,2000);wait(restored,2000);
  assert.equal(restored.state.coins,b.state.coins);assert.deepEqual(restored.entities,b.entities);assert.equal(p2.coins,profile.coins);
});

test('reward and dead enemy checkpoint share one write, so a reload cannot pay again',()=>{
  const {storage,profile,battle:b}=create();b.hit(b.entities[0],30);b.advance(1);
  const coins=profile.coins;assert.equal(coins,9);
  const restored=new CampaignBattle(()=>.1,new Profile(storage));restored.setPaused(false);wait(restored,1000);
  assert.equal(restored.wallet.coins,coins);assert.equal(restored.state.kills,3);
});

test('bad run data recovers only the run while retaining wallet and earned unlocks',()=>{
  const {storage,profile,battle:b}=create();play(b,15000);b.saveRun();const saved=JSON.parse(storage.getItem(CONFIG.arcade.storageKey));
  saved.coins=918;saved.progress.battle.unlocked.pierce=2;
  for(const corrupt of [cp=>cp.state.squad=-2,cp=>cp.entities.push(...Array(13).fill({})),cp=>cp.director.nextEnemy=null,cp=>cp.state.mathLevel=99,cp=>cp.seed='bad']){
    const data=structuredClone(saved);corrupt(data.progress.battle.checkpoint);storage.setItem(CONFIG.arcade.storageKey,JSON.stringify(data));
    const p=new Profile(storage),restored=new CampaignBattle(()=>.1,p);
    assert.equal(restored.recovered,true);assert.equal(restored.state.roundMs,0);assert.equal(p.coins,918);assert.equal(restored.progress.unlocked.pierce,2);
  }
});

test('difficulty requires ten stable choices; first-world expressions stay inside their band',()=>{
  assert.equal(nextDifficulty(0,Array(9).fill(true)),0);assert.equal(nextDifficulty(0,[...Array(8).fill(true),false,false]),1);
  assert.equal(nextDifficulty(1,[...Array(6).fill(true),...Array(4).fill(false)]),1);assert.equal(nextDifficulty(1,Array(10).fill(false)),0);
  assert.equal(nextDifficulty(2,Array(10).fill(true)),2);
  let seed=2;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  for(const level of[0,1,2])for(let i=0;i<1000;i++){
    const g=campaignGate(rng,level),max=level===0?10:20;
    assert.ok(Math.abs(g.options[0].result-g.options[1].result)>=(level===2?1:3));
    for(const o of g.options){assert.ok(o.a<=max&&o.b<=max&&o.result>0&&o.result<=max);assert.equal(o.result,o.op==='+'?o.a+o.b:o.a-o.b);}
  }
  const {battle:b}=create();b.state.elapsedMs=10000;b.state.x=-.5;b.state.lane=1;b.passGate({...campaignGate(()=>.4),passed:false});
  assert.equal(b.progress.skill.samples.length,0);b.state.elapsedMs+=1000;b.steer(-.5);b.passGate({...campaignGate(()=>.4),passed:false});
  assert.equal(b.progress.skill.samples.length,1);
});

test('piercing rounds hit two aligned targets once; chain weapons only splash one nearby target',()=>{
  const {battle:b}=create();b.entities=[];b.bullets=[];b.state.weapon='pierce';b.state.shotClock=100000;
  b.spawn('enemy',0,4,100);b.spawn('enemy',0,6,100);b.spawn('enemy',0,8,100);
  b.shoot();const damage=b.bullets[0].damage;wait(b,200);
  assert.equal(b.entities[0].hp,100-damage);assert.equal(b.entities[1].hp,100-damage);assert.equal(b.entities[2].hp,100);
  b.entities=[];b.state.weapon='arc';b.spawn('enemy',0,8,100);b.spawn('enemy',.4,9,100);b.spawn('enemy',-.4,10,100);
  b.hit(b.entities[0],10);assert.equal(b.entities[0].hp,90);assert.equal(b.entities[1].hp,95);assert.equal(b.entities[2].hp,100);
  assert.ok(b.takeEvents().some(e=>e.type==='arc-link'));
});

test('three complete rounds stop for choices, retain weapons, award first clears once, and unlock a badge',()=>{
  let {storage,profile,battle:b}=create();const durations=[];
  for(let round=0;round<3;round++){
    const elapsed=play(b);durations.push(elapsed);assert.equal(b.state.phase,round===2?'complete':'result');
    assert.ok(elapsed>=CONFIG.harbor.bossTimes[round]&&elapsed<180000);
    assert.equal(b.state.firstReward,CONFIG.campaign.rounds[round].reward);assert.equal(b.progress.cleared,round+1);
    assert.equal(b.state.mathLevel,0);const earned=profile.coins;
    b.finishWave();b.saveRun();assert.equal(profile.coins,earned);assert.equal(b.progress.records[round].runs,1);
    assert.equal(b.choose(0),false);wait(b,900);const time=b.state.roundMs;wait(b,10000);assert.equal(b.state.roundMs,time);
    profile=new Profile(storage);b=new CampaignBattle(()=>.7,profile);b.setPaused(false);assert.equal(b.recovered,false);wait(b,900);
    if(round<2){assert.equal(b.choose(round===0?1:1),true);assert.equal(b.choose(0),false);assert.equal(b.state.weapon,round===0?'pierce':'arc');}
  }
  assert.equal(b.progress.cleared,3);assert.equal(b.progress.unlocked.pierce,1);assert.equal(b.progress.unlocked.arc,1);
  assert.equal(b.selectLoadout('arc'),true);assert.equal(b.replay(),true);assert.equal(b.state.weapon,'arc');assert.equal(b.state.round,0);
  play(b);assert.equal(b.state.firstReward,0);assert.equal(b.progress.records[0].runs,2);
  console.log('Harbor round durations (simulation):',durations.map(ms=>(ms/1000).toFixed(1)).join(', '),'seconds');
});

test('center boss attack has safe edges, and storage failures do not stop a campaign',()=>{
  const p=new Profile({getItem(){return null;},setItem(){throw Error('quota');}}),b=new CampaignBattle(()=>.3,p);
  b.progress.round=2;b.resetRound();b.setPaused(false);
  assert.equal(b.nextAttackLane(),2);b.state.x=.65;assert.equal(b.attackHits({lane:2}),false);b.state.x=0;assert.equal(b.attackHits({lane:2}),true);
  b.hit(b.entities[0],100);b.advance(16);assert.equal(p.status,'memory');assert.ok(p.coins>0);assert.equal(b.state.phase,'combat');
});

test('fresh boss health is fixed by round, independent of recruited squad and chosen weapon',()=>{
  for(let round=0;round<3;round++)for(const squad of [5,30,99])for(const weapon of ['pulse','spread','pierce','arc']){
    const {battle:b}=create();b.progress.round=round;b.resetRound();
    Object.assign(b.state,{squad,weapon,waveMs:b.round.durationMs,shotClock:10000});
    b.entities=[];b.bullets=[];b.gateIndex=100;b.advance(5);
    const boss=b.entities.find(e=>e.kind==='boss');assert.ok(boss);
    assert.equal(boss.maxHp,CONFIG.campaign.rounds[round].bossHp);
  }
});

test('recruiting increases total firepower across pellet thresholds without multiplying the damage budget',()=>{
  const {battle:b}=create();let previous=0;
  for(let squad=1;squad<=200;squad++){
    b.state.squad=squad;const f=b.firepower(false),dps=f.pellets*f.damage*1000/f.interval;
    assert.ok(Math.abs(dps-Math.min(CONFIG.campaign.maxDps,CONFIG.campaign.baseDps+squad*CONFIG.campaign.memberDps))<1e-9);
    assert.ok(dps>=previous-1e-9);previous=dps;
  }
});

test('a larger squad defeats the same boss sooner, and an existing saved boss retains its health',()=>{
  const durations=[];
  for(const squad of [5,30]){
    const {battle:b}=create();b.entities=[];b.bullets=[];b.gates=[];
    b.bossSpawned=b.heavySpawned=b.supplySpawned=true;b.gateIndex=100;b.nextEnemy=b.nextSupply=1e8;b.bossAttackClock=1e8;
    b.harbor=null;b.state.squad=squad;b.spawn('boss',0,9,600);let elapsed=0;
    while(!b.state.bosses&&elapsed<60000){b.advance(25);b.takeEvents();elapsed+=25;}
    assert.equal(b.state.bosses,1);durations.push(elapsed);
  }
  assert.ok(durations[1]<durations[0]*.65,JSON.stringify(durations));
  const {battle:b,storage}=create();b.entities=[];b.spawn('boss',0,9,987);b.entities[0].hp=432;b.bossSpawned=true;b.saveRun();
  const restored=new CampaignBattle(()=>.9,new Profile(storage));assert.equal(restored.recovered,false);
  assert.equal(restored.entities[0].hp,432);assert.equal(restored.entities[0].maxHp,987);
});

test('four simulated hours with minute-by-minute reloads keep campaign rewards and object counts bounded',()=>{
  let {storage,profile,battle:b}=create();let reloads=0,clears=0,firstRewards=0,maxBytes=0;
  for(let time=0;time<4*60*60*1000;time+=200){
    const before=b.state.phase;
    if(before==='combat'){
      const gate=b.gates[0],a=b.state.attack;
      b.steer(a?.phase==='warning'?(a.lane===1?-.65:.65):gate?(gate.correct===0?-.55:.55):Math.sin(time/1400)*.5);
    }else if(b.state.resultMs>=800){if(before==='complete')b.replay();else b.choose(b.state.round===0?0:1);}
    b.advance(200);b.takeEvents();
    if(before==='combat'&&b.state.phase!=='combat'){clears++;firstRewards+=b.state.firstReward;}
    assert.ok(b.entities.length<=12&&b.bullets.length<=100&&b.gates.length<=2&&b.state.squad>=1);
    assert.ok(b.progress.skill.samples.length<=10);
    if(time%60000===0){
      b.setPaused(true);maxBytes=Math.max(maxBytes,Buffer.byteLength(storage.getItem(CONFIG.arcade.storageKey),'utf8'));
      profile=new Profile(storage);b=new CampaignBattle(()=>.9,profile);assert.equal(b.recovered,false);b.setPaused(false);reloads++;
      assert.equal(profile.coins,b.state.coins);
    }
  }
  assert.equal(reloads,240);assert.ok(clears>60);assert.equal(firstRewards,200);assert.ok(maxBytes<64000);
  console.log('4h simulation:',{clears,reloads,maxBytes,coins:profile.coins});
});
