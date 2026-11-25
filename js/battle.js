import { CONFIG } from './config.js';
import { Pool } from './engine.js';

const limit = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (random, min, max) => min + Math.floor(random() * (max - min + 1));
export function expression(random = Math.random) {
  const max = CONFIG.battle.maxOperand;
  if (random() < 0.5) {
    const result = integer(random, 2, max); const a = integer(random, 1, result - 1);
    return { a, b: result - a, op: '+', result, text: a + ' + ' + (result - a) };
  }
  const a = integer(random, 2, max); const b = integer(random, 1, a - 1);
  return { a, b, op: '−', result: a - b, text: a + ' − ' + b };
}
export function makeGate(random = Math.random, opening = false) {
  let a = opening ? { a: 7, b: 8, op: '+', result: 15, text: '7 + 8' } : expression(random);
  let b = opening ? { a: 19, b: 2, op: '−', result: 17, text: '19 − 2' } : expression(random);
  if (!opening && random() < 0.18) b = { a: 3, b: 5, op: '−', result: -2, text: '3 − 5' };
  for (let tries = 0; b.result === a.result && tries < 12; tries += 1) b = expression(random);
  if (b.result === a.result) b = { a: 0, b: a.result === 20 ? 19 : a.result + 1, op: '+', result: a.result === 20 ? 19 : a.result + 1, text: '0 + ' + (a.result === 20 ? 19 : a.result + 1) };
  if (random() < 0.5) [a, b] = [b, a];
  return { options: [a, b], correct: a.result > b.result ? 0 : 1, blueSide: random() < 0.5 ? 0 : 1 };
}

export class Battle {
  constructor(random = Math.random, wallet = null) {
    this.random = random; this.wallet = wallet; this.events = [];
    this.entityPool=new Pool(CONFIG.battle.maxEntities);this.bulletPool=new Pool(CONFIG.battle.maxBullets);this.gatePool=new Pool(2);this.candidates=[];
    this.state = { paused: false, axis: 0, substepMs: 0, elapsedMs: 0, waveMs: 0, wave: 1, squad: CONFIG.battle.initialSquad,
      x: 0, targetX: 0, coins: 0, kills: 0, bosses: 0, gatesPassed: 0, shots: 0,
      shotClock: 0, recoilMs: 0, shakeMs: 0, banner: '', bannerMs: 0, clearingMs: 0, distance: 0, gateResult: null,
      charge: 0, powerMs: 0, powerStarts: 0, combo: 0, comboMs: 0, attack: null, bossAttacks: 0, dodges: 0, bossHits: 0 };
    this.entities = []; this.gates = []; this.bullets = []; this.nextId = 1;
    this.startWave();
  }
  get entities(){return this.entityPool.active;}
  set entities(values){this.entityPool.restore(values);}
  get bullets(){return this.bulletPool.active;}
  set bullets(values){this.bulletPool.restore(values);}
  get gates(){return this.gatePool.active;}
  set gates(values){this.gatePool.restore(values);}
  emit(event) { if (this.events.length < 128) this.events.push(event); }
  get rules() { return CONFIG.battle; }
  createGate() { return makeGate(this.random,this.state.wave===1&&this.gateIndex===0); }
  finishWave() { this.state.wave+=1;this.startWave();this.emit({type:'wave'}); }
  nextAttackLane() { return this.state.x<0?0:1; }
  attackHits(attack) { return Math.abs(this.state.x-(attack.lane===0?-.4:.4))<.4*CONFIG.engine.hurtScale; }
  takeEvents() { return this.events.splice(0); }
  reward(amount) { this.state.coins += amount; this.wallet?.credit(amount); }
  hurt(amount) { this.state.squad=Math.max(1,this.state.squad-amount);return true; }
  collectSupply(entity) { entity.dead=true; }
  canHit(entity) { return entity.kind!=='supply'; }
  setPaused(paused) {
    if(this.state.paused&&!paused&&this.state.attack?.phase==='warning')this.state.attack.remainingMs=this.rules.bossWarningMs;
    this.state.paused = Boolean(paused);if(paused)this.state.axis=0;
  }
  setAxis(axis){this.state.axis=Number.isFinite(axis)?limit(axis,-1,1):0;}
  steer(x) { if (Number.isFinite(x) && !this.state.paused) this.state.targetX = limit(x, -CONFIG.battle.maxX, CONFIG.battle.maxX); }
  startWave() {
    this.state.waveMs = 0; this.gateIndex = 0; this.nextEnemy = this.rules.enemyEveryMs;
    this.heavySpawned = false; this.bossSpawned = false; this.supplySpawned = false; this.formation = 0;
    this.state.attack = null; this.bossAttackClock = this.rules.bossFirstAttackMs;
    this.entities = []; this.gates = []; this.bullets = [];
    this.spawn('barrel', 0, CONFIG.battle.openingZ, 30, { explosive: true });
    for(const side of [-1,1])this.spawn('enemy',side*.48,CONFIG.battle.openingZ+2,12);
  }
  spawn(kind, x, z, hp, options = {}) {
    if (this.entities.length >= CONFIG.battle.maxEntities) return;
    this.entityPool.acquire({ id: this.nextId++, kind, x, baseX:x, z, hp, maxHp: hp, hitMs: 0, dead: false,
      crack: 0, rage: false, radius: kind === 'boss' ? 1.25 : 0.28, ...options });
  }
  firepower(powered = this.state.powerMs > 0) {
    const b=CONFIG.battle;
    return {pellets:Math.min(b.maxPellets,Math.max(powered?b.powerMinPellets:1,1+Math.floor(this.state.squad/12))),
      damage:Math.min(b.maxDamage,Math.ceil(this.state.squad/3))*(powered?b.powerDamage:1),interval:powered?b.powerShotMs:b.shotMs};
  }
  powerUp() {
    const s=this.state;s.powerMs=CONFIG.battle.powerMs;s.charge=0;s.powerStarts+=1;s.shotClock=0;
    this.emit({type:'power-up',x:s.x,z:CONFIG.battle.playerZ});
  }
  spawnFormation() {
    const order=this.rules.patterns,pattern=order?order[this.formation++%order.length]:(this.formation++ + this.state.wave-1)%3,hp=18+Math.min(60,this.state.wave*4);
    if(pattern===0){for(const x of[-.64,0,.64])this.spawn('enemy',x,30+Math.abs(x)*4,hp);}
    else if(pattern===1){
      const x=this.random()<.5?-.38:.38;
      this.spawn('barrel',x,29,30,{explosive:true});
      for(const side of[-1,1])this.spawn('enemy',x+side*.32,31,hp);
    }else for(const x of[-.5,.5])this.spawn('enemy',x,31,hp,{weave:true});
  }
  shoot() {
    const s = this.state; const b = CONFIG.battle;
    const {pellets,damage} = this.firepower();
    for (let i = 0; i < pellets && this.bullets.length < b.maxBullets; i += 1) {
      this.bulletPool.acquire({ x: s.x + (i - (pellets - 1) / 2) * 0.10, z: b.playerZ + 0.3, damage, powered:s.powerMs>0, id: this.nextId++ });
    }
    s.shots += pellets; s.recoilMs = 65;
    this.emit({ type: 'shot', power: pellets, powered:s.powerMs>0 });
  }
  gateChoice(gate) { return Math.abs(this.state.x)<=.4*(CONFIG.engine.collectScale-1)?gate.correct:this.state.x<0?0:1; }
  passGate(gate) {
    if (gate.passed) return;
    gate.passed = true;
    const s = this.state; const index = this.gateChoice(gate);
    const selected = gate.options[index]; const good = index === gate.correct;
    const previous = s.squad;
    if (selected.result >= 0) {
      s.squad = Math.min(CONFIG.battle.maxSquad, s.squad + selected.result);
      this.reward(CONFIG.battle.gateCoins);
    } else s.squad = Math.max(1, s.squad - Math.max(1, Math.min(CONFIG.battle.penalty, Math.floor(s.squad * CONFIG.battle.penaltyFraction))));
    s.gatesPassed += 1; s.gateResult = { text: selected.text, result: selected.result, good, change: s.squad - previous };
    const recruited=selected.result>=0;
    s.banner = (recruited ? '+' : '−') + Math.abs(s.squad - previous); s.bannerMs = 1400;
    s.shakeMs = recruited ? 160 : 90;
    this.emit({ type: recruited ? 'gate-win' : 'gate-miss', x: s.x, z: CONFIG.battle.playerZ, change: s.squad - previous });
  }
  hit(entity, damage, chain = false) {
    if (entity.dead) return;
    const dealt=Math.min(entity.hp,damage),beforeCrack=entity.crack;
    entity.hp = Math.max(0, entity.hp - damage); entity.hitMs = CONFIG.battle.hitMs;
    entity.crack=entity.hp>0?Math.min(2,Math.floor((1-entity.hp/entity.maxHp)*3)):3;
    this.emit({ type: 'hit', id:entity.id, kind:entity.kind, x: entity.x, z: entity.z, damage:dealt, crack:entity.crack, chain });
    if(entity.crack>beforeCrack&&entity.hp>0)this.emit({type:'armor-break',kind:entity.kind,x:entity.x,z:entity.z});
    if(entity.kind==='boss'&&!entity.rage&&entity.hp>0&&entity.hp<=entity.maxHp*.5){entity.rage=true;this.emit({type:'boss-rage',x:0,z:entity.z});}
    if (entity.hp) return;
    entity.dead = true; this.state.kills += 1;
    const boss = entity.kind === 'boss';
    const coins = boss ? CONFIG.battle.bossCoins : entity.kind === 'crate' ? CONFIG.battle.supplyCoins : entity.kind === 'barrel' ? CONFIG.battle.barrelCoins : CONFIG.battle.enemyCoins;
    this.reward(coins); this.state.shakeMs = boss ? 360 : 130;
    this.state.combo=this.state.comboMs>0?this.state.combo+1:1;this.state.comboMs=CONFIG.battle.comboMs;
    this.emit({ type: 'explode', kind:entity.kind, explosive:entity.explosive, x: entity.x, z: entity.z, boss, coins, combo:this.state.combo, chain });
    if(entity.kind==='crate')this.powerUp();
    else if(!boss&&!this.state.powerMs){this.state.charge+=1;if(this.state.charge>=CONFIG.battle.chargeKills)this.powerUp();}
    // Mark the source dead before the cascade: every prop/reward can resolve only once.
    if(entity.explosive)for(const target of this.entities){
      if(!target.dead&&!['boss','lock','supply'].includes(target.kind)&&Math.abs(target.x-entity.x)<=CONFIG.battle.chainRadiusX&&Math.abs(target.z-entity.z)<=CONFIG.battle.chainRadiusZ)this.hit(target,CONFIG.battle.chainDamage,true);
    }
    if (boss) {
      this.state.bosses += 1; this.state.clearingMs = CONFIG.battle.waveBreakMs;
      this.state.banner = 'CLEAR!'; this.state.bannerMs = CONFIG.battle.waveBreakMs;
      this.entities.forEach((item) => { item.dead = true; }); this.gates = []; this.bullets = [];this.state.attack=null;
    }
  }
  updateBoss(ms) {
    const s=this.state,b=this.rules,boss=this.entities.find(e=>e.kind==='boss'&&!e.dead);
    if(!boss)return;
    if(s.attack){
      s.attack.remainingMs=Math.max(0,s.attack.remainingMs-ms);
      if(s.attack.remainingMs>0)return;
      if(s.attack.phase==='warning'){
        const hit=this.attackHits(s.attack);
        s.attack.phase='slam';s.attack.remainingMs=b.bossSlamMs;s.bossAttacks+=1;
        if(hit){if(this.hurt(b.bossPenalty))s.bossHits+=1;}else s.dodges+=1;
        s.shakeMs=hit?240:100;
        this.emit({type:'boss-slam',x:s.attack.lane===2?0:s.attack.lane===0?-.55:.55,z:b.playerZ,hit});
      }else{s.attack=null;this.bossAttackClock=boss.rage?b.bossRageGapMs:b.bossAttackGapMs;}
    }else{
      this.bossAttackClock=Math.max(0,this.bossAttackClock-ms);
      if(this.bossAttackClock<=0){s.attack={lane:this.nextAttackLane(),phase:'warning',remainingMs:b.bossWarningMs};this.emit({type:'boss-warning'});}
    }
  }
  tick(ms) {
    const s = this.state; const b = this.rules; const dt = ms / 1000;
    s.elapsedMs += ms; s.recoilMs = Math.max(0, s.recoilMs - ms); s.shakeMs = Math.max(0, s.shakeMs - ms);
    s.bannerMs = Math.max(0, s.bannerMs - ms);
    s.powerMs=Math.max(0,s.powerMs-ms);s.comboMs=Math.max(0,s.comboMs-ms);
    if(!s.comboMs)s.combo=0;
    if(s.axis)s.targetX=limit(s.targetX+s.axis*CONFIG.battle.keyboardSteerSpeed*dt,-b.maxX,b.maxX);
    const movement = limit(s.targetX - s.x, -b.steerSpeed * dt, b.steerSpeed * dt);
    s.x += movement;
    if (s.clearingMs > 0) {
      s.clearingMs = Math.max(0, s.clearingMs - ms);
      if (!s.clearingMs) this.finishWave();
      return;
    }
    s.waveMs += ms; s.distance += b.speed * dt;
    if (this.gateIndex < b.gateTimes.length && s.waveMs >= b.gateTimes[this.gateIndex]) {
      this.gatePool.acquire({ ...this.createGate(), z: b.gateZ, passed: false, id: this.nextId++ });
      this.gateIndex += 1;
    }
    if (s.waveMs >= this.nextEnemy && s.waveMs < b.bossAtMs - 2500) {
      this.spawnFormation();
      this.nextEnemy += b.enemyEveryMs;
    }
    if(s.waveMs>=b.supplyAtMs&&!this.supplySpawned){this.spawn('crate',0,22,b.supplyHp);this.supplySpawned=true;}
    if (s.waveMs >= 8000 && !this.heavySpawned) {
      this.spawn('barrel', this.random() < 0.5 ? -0.5 : 0.5, 32, 150); this.heavySpawned = true;
    }
    if (s.waveMs >= b.bossAtMs && !this.bossSpawned) {
      const hp=b.bossHp+(s.wave-1)*b.bossHpPerWave;
      this.spawn('boss', 0, b.bossSpawnZ, hp); this.bossSpawned = true;
      s.shakeMs = 150;
      this.emit({ type: 'boss' });
    }
    for (const gate of this.gates) {
      gate.z -= b.speed * dt*(gate.speedMultiplier??1);
      if (gate.z <= b.playerZ) this.passGate(gate);
    }
    this.gatePool.prune(gate => !gate.passed);
    s.shotClock -= ms;
    while (s.shotClock <= 0) { this.shoot(); s.shotClock += this.firepower().interval; }
    for (const entity of this.entities) {
      entity.previousZ = entity.z;
      entity.z = entity.kind === 'boss' ? Math.max(9, entity.z - b.speed * dt) : entity.kind==='lock'?Math.max(8.2,entity.z-b.speed*dt):entity.z-b.speed*dt;
      entity.hitMs = Math.max(0, entity.hitMs - ms);
      if(entity.weave)entity.x=entity.baseX+Math.sin(s.elapsedMs/550+entity.id)*.18;
    }
    // Sweep relative motion: a projectile cannot tunnel through a moving target.
    for (const bullet of this.bullets) {
      const previousZ = bullet.z; bullet.z += b.bulletSpeed * dt;
      const candidates=this.candidates;candidates.length=0;
      for(const entity of this.entities)if(!entity.dead&&this.canHit(entity)&&!bullet.hitIds?.includes(entity.id)&&Math.abs(entity.x-bullet.x)<=entity.radius*CONFIG.engine.collectScale&&previousZ<=entity.previousZ+.45&&bullet.z>=entity.z-.45)candidates.push(entity);
      candidates.sort((a,c)=>a.z-c.z);
      for(const target of candidates){
        this.hit(target,bullet.damage);(bullet.hitIds??=[]).push(target.id);bullet.remaining=(bullet.remaining??1)-1;
        if(bullet.remaining<=0){bullet.spent=true;break;}
      }
    }
    this.bulletPool.prune(bullet => !bullet.spent && bullet.z < b.farZ);
    for (const entity of this.entities) {
      if (entity.dead || entity.z > b.playerZ - 0.3) continue;
      if(entity.kind==='supply'){this.collectSupply(entity);continue;}
      if (Math.abs(entity.x - s.x) < 0.42*CONFIG.engine.hurtScale) {
        this.hurt(1);s.shakeMs = 100;
        this.emit({ type: 'bump', x: s.x, z: b.playerZ });
      }
      entity.dead = true;
    }
    this.entityPool.prune(entity => !entity.dead);
    this.updateBoss(ms);
  }
  advance(deltaMs) {
    if (this.state.paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.state.substepMs+=Math.min(deltaMs,CONFIG.battle.maxFrameMs);
    while(this.state.substepMs+1e-8>=CONFIG.engine.stepMs){this.state.substepMs=Math.max(0,this.state.substepMs-CONFIG.engine.stepMs);this.tick(CONFIG.engine.stepMs);}
  }
  snapshot() {
    return { ...this.state, attack:this.state.attack?{...this.state.attack}:null, gateResult: this.state.gateResult ? { ...this.state.gateResult } : null,
      entities: this.entities.map((entity) => ({ ...entity })),
      gates: this.gates.map((gate) => ({ ...gate, options: gate.options.map((option) => ({ ...option })) })),
      bulletCount: this.bullets.length, entityCount: this.entities.length, queuedEvents: this.events.length };
  }
}
