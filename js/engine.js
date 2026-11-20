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

export class Haptics {
  constructor(profile, device = globalThis.navigator) { this.profile = profile; this.device = device; this.last = -Infinity; }
  play(event, now = globalThis.performance?.now() ?? Date.now()) {
    if (!this.profile.data.settings.haptics || now - this.last < 60) return;
    const pattern = event?.type === 'explode' && event.boss ? [18, 35, 28]
      : ['brake-win', 'sentence', 'mission-win'].includes(event?.type) ? [10, 25, 16]
      : ['hit', 'land', 'pickup', 'word'].includes(event?.type) ? 7 : null;
    if (!pattern) return;
    try { this.device?.vibrate?.(pattern); this.last = now; } catch { /* Optional hardware. */ }
  }
  stop() { try { this.device?.vibrate?.(0); } catch { /* Optional hardware. */ } }
}
