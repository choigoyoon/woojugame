import { CONFIG } from './config.js';

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
    this.state = { paused: false, elapsedMs: 0, waveMs: 0, wave: 1, squad: CONFIG.battle.initialSquad,
      x: 0, targetX: 0, coins: 0, kills: 0, bosses: 0, gatesPassed: 0, shots: 0,
      shotClock: 0, recoilMs: 0, shakeMs: 0, banner: '', bannerMs: 0, clearingMs: 0, distance: 0, gateResult: null };
    this.entities = []; this.gates = []; this.bullets = []; this.nextId = 1;
    this.startWave();
  }
  emit(event) { if (this.events.length < 128) this.events.push(event); }
  takeEvents() { return this.events.splice(0); }
  reward(amount) { this.state.coins += amount; this.wallet?.credit(amount); }
  setPaused(paused) { this.state.paused = Boolean(paused); }
  steer(x) { if (Number.isFinite(x) && !this.state.paused) this.state.targetX = limit(x, -CONFIG.battle.maxX, CONFIG.battle.maxX); }
  startWave() {
    this.state.waveMs = 0; this.gateIndex = 0; this.nextEnemy = CONFIG.battle.enemyEveryMs;
    this.heavySpawned = false; this.bossSpawned = false;
    this.entities = []; this.gates = []; this.bullets = [];
    this.spawn('barrel', 0, 22, 30);
  }
  spawn(kind, x, z, hp) {
    if (this.entities.length >= CONFIG.battle.maxEntities) return;
    this.entities.push({ id: this.nextId++, kind, x, z, hp, maxHp: hp, hitMs: 0, dead: false, radius: kind === 'boss' ? 1.25 : 0.28 });
  }
  shoot() {
    const s = this.state; const b = CONFIG.battle;
    const pellets = Math.min(b.maxPellets, 1 + Math.floor(s.squad / 12));
    const damage = Math.min(b.maxDamage, Math.ceil(s.squad / 3));
    for (let i = 0; i < pellets && this.bullets.length < b.maxBullets; i += 1) {
      this.bullets.push({ x: s.x + (i - (pellets - 1) / 2) * 0.10, z: b.playerZ + 0.3, damage, id: this.nextId++ });
    }
    s.shots += pellets; s.recoilMs = 65;
    this.emit({ type: 'shot', power: pellets });
  }
  passGate(gate) {
    if (gate.passed) return;
    gate.passed = true;
    const s = this.state; const index = s.x < 0 ? 0 : 1;
    const selected = gate.options[index]; const good = index === gate.correct;
    const previous = s.squad;
    if (good) {
      s.squad = Math.min(CONFIG.battle.maxSquad, s.squad + selected.result);
      this.reward(CONFIG.battle.gateCoins);
    } else s.squad = Math.max(1, s.squad - Math.max(1, Math.min(CONFIG.battle.penalty, Math.floor(s.squad * CONFIG.battle.penaltyFraction))));
    s.gatesPassed += 1; s.gateResult = { text: selected.text, result: selected.result, good, change: s.squad - previous };
    s.banner = (good ? '+' : '−') + Math.abs(s.squad - previous); s.bannerMs = 1400;
    s.shakeMs = good ? 160 : 90;
    this.emit({ type: good ? 'gate-win' : 'gate-miss', x: s.x, z: CONFIG.battle.playerZ, change: s.squad - previous });
  }
  hit(entity, damage) {
    if (entity.dead) return;
    entity.hp = Math.max(0, entity.hp - damage); entity.hitMs = CONFIG.battle.hitMs;
    this.emit({ type: 'hit', x: entity.x, z: entity.z, damage });
    if (entity.hp) return;
    entity.dead = true; this.state.kills += 1;
    const boss = entity.kind === 'boss';
    const coins = boss ? CONFIG.battle.bossCoins : entity.kind === 'barrel' ? CONFIG.battle.barrelCoins : CONFIG.battle.enemyCoins;
    this.reward(coins); this.state.shakeMs = boss ? 360 : 130;
    this.emit({ type: 'explode', x: entity.x, z: entity.z, boss, coins });
    if (boss) {
      this.state.bosses += 1; this.state.clearingMs = CONFIG.battle.waveBreakMs;
      this.state.banner = 'CLEAR!'; this.state.bannerMs = CONFIG.battle.waveBreakMs;
      this.entities.forEach((item) => { item.dead = true; }); this.gates = []; this.bullets = [];
    }
  }
  tick(ms) {
    const s = this.state; const b = CONFIG.battle; const dt = ms / 1000;
    s.elapsedMs += ms; s.recoilMs = Math.max(0, s.recoilMs - ms); s.shakeMs = Math.max(0, s.shakeMs - ms);
    s.bannerMs = Math.max(0, s.bannerMs - ms);
    const movement = limit(s.targetX - s.x, -b.steerSpeed * dt, b.steerSpeed * dt);
    s.x += movement;
    if (s.clearingMs > 0) {
      s.clearingMs = Math.max(0, s.clearingMs - ms);
      if (!s.clearingMs) { s.wave += 1; this.startWave(); this.emit({ type: 'wave' }); }
      return;
    }
    s.waveMs += ms; s.distance += b.speed * dt;
    if (this.gateIndex < b.gateTimes.length && s.waveMs >= b.gateTimes[this.gateIndex]) {
      this.gates.push({ ...makeGate(this.random, s.wave === 1 && this.gateIndex === 0), z: b.gateZ, passed: false, id: this.nextId++ });
      this.gateIndex += 1;
    }
    if (s.waveMs >= this.nextEnemy && s.waveMs < b.bossAtMs - 2500) {
      this.spawn('enemy', this.random() < 0.5 ? -0.56 : 0.56, 36, 18 + Math.min(60, s.wave * 4));
      this.nextEnemy += b.enemyEveryMs;
    }
    if (s.waveMs >= 8000 && !this.heavySpawned) {
      this.spawn('barrel', this.random() < 0.5 ? -0.5 : 0.5, 32, 150); this.heavySpawned = true;
    }
    if (s.waveMs >= b.bossAtMs && !this.bossSpawned) {
      this.spawn('boss', 0, b.bossSpawnZ, b.bossHp + (s.wave - 1) * b.bossHpPerWave); this.bossSpawned = true;
      s.shakeMs = 150;
      this.emit({ type: 'boss' });
    }
    for (const gate of this.gates) {
      gate.z -= b.speed * dt;
      if (gate.z <= b.playerZ) this.passGate(gate);
    }
    this.gates = this.gates.filter((gate) => !gate.passed);
    s.shotClock -= ms;
    while (s.shotClock <= 0) { this.shoot(); s.shotClock += b.shotMs; }
    for (const entity of this.entities) {
      entity.previousZ = entity.z;
      entity.z = entity.kind === 'boss' ? Math.max(9, entity.z - b.speed * dt) : entity.z - b.speed * dt;
      entity.hitMs = Math.max(0, entity.hitMs - ms);
    }
    // Sweep relative motion: a projectile cannot tunnel through a moving target.
    for (const bullet of this.bullets) {
      const previousZ = bullet.z; bullet.z += b.bulletSpeed * dt;
      const candidates = this.entities.filter((entity) => !entity.dead && Math.abs(entity.x - bullet.x) <= entity.radius
        && previousZ <= entity.previousZ + 0.45 && bullet.z >= entity.z - 0.45).sort((a, c) => a.z - c.z);
      if (candidates.length) { this.hit(candidates[0], bullet.damage); bullet.spent = true; }
    }
    this.bullets = this.bullets.filter((bullet) => !bullet.spent && bullet.z < b.farZ);
    for (const entity of this.entities) {
      if (entity.dead || entity.z > b.playerZ - 0.3) continue;
      if (Math.abs(entity.x - s.x) < 0.42) {
        s.squad = Math.max(1, s.squad - 1); s.shakeMs = 100;
        this.emit({ type: 'bump', x: s.x, z: b.playerZ });
      }
      entity.dead = true;
    }
    this.entities = this.entities.filter((entity) => !entity.dead);
  }
  advance(deltaMs) {
    if (this.state.paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    let left = Math.min(deltaMs, CONFIG.battle.maxFrameMs);
    while (left > 0) { const dt = Math.min(left, CONFIG.battle.fixedStepMs); this.tick(dt); left -= dt; }
  }
  snapshot() {
    return { ...this.state, gateResult: this.state.gateResult ? { ...this.state.gateResult } : null,
      entities: this.entities.map((entity) => ({ ...entity })),
      gates: this.gates.map((gate) => ({ ...gate, options: gate.options.map((option) => ({ ...option })) })),
      bulletCount: this.bullets.length, entityCount: this.entities.length, queuedEvents: this.events.length };
  }
}
