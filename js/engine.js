import { CONFIG } from './config.js';

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const copy = value => JSON.parse(JSON.stringify(value));

/** Real frames are capped by FrameClock; models consume the same fixed ticks at every refresh rate. */
export class FixedStepper {
  constructor() { this.remainder = 0; }
  advance(ms, tick) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.remainder += ms;
    const step = CONFIG.engine.stepMs;
    while (this.remainder + 1e-8 >= step) {
      this.remainder = Math.max(0, this.remainder - step);
      tick(step);
    }
  }
}

/** Stable instances and active array, recycled without per-frame filter/map allocations. */
export class Pool {
  constructor(capacity, factory = () => ({})) {
    this.items = Array.from({ length: capacity }, factory);
    this.free = [...this.items]; this.active = []; this.capacity = capacity;
  }
  acquire(values) {
    const item = this.free.pop();
    if (!item) return null;
    for (const key of Object.keys(item)) if (!Object.hasOwn(values, key)) delete item[key];
    Object.assign(item, values); this.active.push(item); return item;
  }
  prune(keep) {
    let write = 0;
    for (let i = 0; i < this.active.length; i++) {
      const item = this.active[i];
      if (keep(item)) this.active[write++] = item; else this.free.push(item);
    }
    this.active.length = write;
  }
  clear() { while (this.active.length) this.free.push(this.active.pop()); }
  restore(values) { this.clear(); for (const value of values) this.acquire(copy(value)); }
}

export class InputBuffer {
  constructor(capacity = 8) { this.pool = new Pool(capacity); }
  push(action, now) { this.expire(now); return this.pool.acquire({ action, expires: now + CONFIG.engine.bufferMs }); }
  expire(now) { this.pool.prune(item => item.expires + 1e-8 >= now); }
  take(now) {
    this.expire(now); const item = this.pool.active[0];
    if (!item) return null;
    const action = item.action; this.pool.prune(candidate => candidate !== item); return action;
  }
  clear() { this.pool.clear(); }
}

/**
 * 3D Rigid-Body LEGO Brick & Stud Fracture Physics Engine.
 * Simulates ballistic trajectories, floor plane collision, restitution bounces, friction, and angular tumble.
 */
export class PhysicsWorld {
  constructor(capacity = 36) {
    this.bodies = Array.from({ length: capacity }, () => ({ life: 0 }));
    this.cursor = 0;
  }
  clear() {
    for (const b of this.bodies) b.life = 0;
  }
  spawn(config) {
    const b = this.bodies[this.cursor++ % this.bodies.length];
    Object.assign(b, {
      x: 360, y: 640, vx: 0, vy: -220,
      floorY: 868, restitution: 0.54, friction: 0.76, gravity: 1180,
      angle: 0, spin: 6, bounces: 0, maxBounces: 3,
      w: 20, h: 14, d: 6, kind: 'brick',
      front: '#ffcf5c', top: '#fff5b8', side: '#b8792c',
      life: 920, duration: 920,
      ...config,
    });
    return b;
  }
  burst({ x, y, floorY = 868, count = 8, palette = [['#ffcf5c', '#fff5b8', '#b8792c'], ['#63e6dc', '#d6fffb', '#2b8a87'], ['#ff6e80', '#ffc2ca', '#9e3548']] }) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 2) * 0.35;
      const speed = 110 + (i % 4) * 58;
      const [front, top, side] = palette[i % palette.length];
      const isStud = i % 3 === 0;
      this.spawn({
        x, y,
        vx: Math.cos(a) * speed,
        vy: -150 - Math.abs(Math.sin(a)) * 240 - (i % 3) * 45,
        floorY: Math.max(y + 36, Math.min(1140, floorY + ((i % 3) - 1) * 18)),
        angle: a * 0.4,
        spin: (i % 2 ? 1 : -1) * (5 + (i % 4) * 2.5),
        kind: isStud ? 'stud' : 'brick',
        w: isStud ? 14 : 18 + (i % 2) * 8,
        h: isStud ? 8 : 12 + (i % 2) * 4,
        d: isStud ? 4 : 5,
        front, top, side,
        life: 820 + (i % 3) * 120,
        duration: 820 + (i % 3) * 120,
      });
    }
  }
  step(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    const dt = ms / 1000;
    for (const b of this.bodies) {
      if (b.life <= 0) continue;
      b.life = Math.max(0, b.life - ms);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += b.gravity * dt;
      b.angle += b.spin * dt;
      if (b.y >= b.floorY) {
        b.y = b.floorY;
        if (b.bounces < b.maxBounces && Math.abs(b.vy) > 45) {
          b.vy = -Math.abs(b.vy) * b.restitution;
          b.vx *= b.friction;
          b.spin *= 0.62;
          b.bounces += 1;
        } else {
          b.vy = 0;
          b.vx *= 0.85;
          b.spin *= 0.4;
          b.angle *= 0.8;
        }
      }
    }
  }
  get activeCount() {
    let n = 0;
    for (const b of this.bodies) if (b.life > 0) n++;
    return n;
  }
}

/**
 * 2nd-Order Spring & Trauma Camera Rig for directional hit kick, zoom punch, and screen shake.
 */
export class CameraRig {
  constructor() { this.reset(); }
  reset() {
    this.trauma = 0; this.zoom = 0; this.zoomVel = 0;
    this.kickX = 0; this.kickY = 0; this.time = 0;
  }
  impulse({ trauma = 0.3, zoom = 0.025, dx = 0, dy = 0 } = {}) {
    this.trauma = Math.min(1, this.trauma + trauma);
    this.zoomVel += zoom * 18;
    this.kickX = clamp(this.kickX + dx, -18, 18);
    this.kickY = clamp(this.kickY + dy, -18, 18);
  }
  step(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    const dt = Math.min(0.05, ms / 1000);
    this.time += ms;
    this.trauma = Math.max(0, this.trauma - dt * 2.8);
    // Critically damped spring for zoom punch
    const freq = 24, damp = 0.68;
    const accel = -freq * freq * this.zoom - 2 * damp * freq * this.zoomVel;
    this.zoomVel += accel * dt;
    this.zoom += this.zoomVel * dt;
    if (Math.abs(this.zoom) < 1e-4 && Math.abs(this.zoomVel) < 1e-4) { this.zoom = 0; this.zoomVel = 0; }
    const decay = Math.exp(-dt * 16);
    this.kickX *= decay;
    this.kickY *= decay;
  }
   get offset() {
    const shake = this.trauma * this.trauma;
    return {
      x: this.kickX + Math.sin(this.time * 0.09) * shake * 9,
      y: this.kickY + Math.cos(this.time * 0.12) * shake * 7,
      scale: 1 + clamp(this.zoom, -0.04, 0.06),
    };
  }
}

/**
 * Floating Arcade Callout Banner Pool with spring overshoot scale animation.
 */
export class CalloutPool {
  constructor(capacity = 8) {
    this.items = Array.from({ length: capacity }, () => ({ life: 0 }));
    this.cursor = 0;
  }
  clear() { for (const c of this.items) c.life = 0; }
  spawn(text, x, y, color = '#ffe875', sub = '') {
    const item = this.items[this.cursor++ % this.items.length];
    Object.assign(item, { text, sub, x: clamp(x, 120, 600), y: clamp(y, 180, 960), color, life: 880, duration: 880 });
    return item;
  }
  step(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    for (const c of this.items) {
      if (c.life <= 0) continue;
      c.life = Math.max(0, c.life - ms);
      c.y -= ms * 0.042;
    }
  }
  get activeCount() {
    let n = 0;
    for (const c of this.items) if (c.life > 0) n++;
    return n;
  }
}

export class Haptics {
  constructor(profile, device = globalThis.navigator) { this.profile = profile; this.device = device; this.last = -Infinity; }
  play(event, now = globalThis.performance?.now() ?? Date.now()) {
    if (!this.profile.data.settings.haptics || now - this.last < 60) return;
    const pattern = event?.type === 'explode' && event.boss ? [18, 35, 28]
      : ['brake-win', 'sentence', 'mission-win'].includes(event?.type) ? [10, 25, 16]
      : ['hit', 'land', 'pickup', 'word', 'smash'].includes(event?.type) ? 7 : null;
    if (!pattern) return;
    try { this.device?.vibrate?.(pattern); this.last = now; } catch { /* Optional hardware. */ }
  }
  stop() { try { this.device?.vibrate?.(0); } catch { /* Optional hardware. */ } }
}
