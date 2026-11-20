import { CONFIG } from './config.js';

// Preserve the 60fps phase on 90/120Hz displays; do not delay a fresh interval
// from each presented frame (which would turn 90Hz into 45fps).
export class FramePacer {
  constructor() { this.reset(); }
  reset() { this.next = null; this.last = -Infinity; }
  due(now) {
    if (!Number.isFinite(now)) return false;
    const interval = 1000 / CONFIG.performance.targetFps;
    const tolerance = CONFIG.performance.frameToleranceMs;
    if (now < this.last) this.reset();
    const arrival = now - this.last;
    this.last = now;
    // Native 60Hz (or slower) needs every callback. Re-anchor to its phase so
    // gradual display-clock drift cannot alternate a skipped and a late frame.
    if (this.next === null || arrival >= interval - tolerance) {
      this.next = now + interval; return true;
    }
    if (now + tolerance < this.next) return false;
    // Missed deadlines are discarded, never replayed in a burst.
    this.next += (Math.floor(Math.max(0, now + tolerance - this.next) / interval) + 1) * interval;
    return true;
  }
}

// Observe presented frames. Only pixel density changes; game time remains elapsed time.
export class FrameBudget {
  constructor() {
    this.scale = 1;
    this.changes = 0;
    this.intervals = new Float32Array(512);
    this.costs = new Float32Array(512);
    this.stats = { fps: 0, cadenceHz: 0, workMs: 0, missRatio: 0 };
    this.changedAt = -Infinity;
    this.reset(0);
  }

  reset(now) {
    this.last = NaN;
    this.span = this.count = this.slow = this.healthy = 0;
    this.warmUntil = now + CONFIG.performance.warmupMs;
  }

  sample(now, workMs) {
    const cfg = CONFIG.performance;
    const dt = now - this.last;
    this.last = now;
    if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(workMs)) return false;
    if (dt > cfg.maxGapMs) { this.reset(now); return false; }
    if (now < this.warmUntil) return false;

    this.span += dt;
    const i = this.count++ % this.intervals.length;
    this.intervals[i] = dt;
    this.costs[i] = Math.max(0, workMs);
    if (this.span < cfg.windowMs) return false;

    // Allocate/sort only once per measurement window, never on every draw.
    const n = Math.min(this.count, this.intervals.length);
    const times = Array.from(this.intervals.subarray(0, n)).sort((a, b) => a - b);
    const costs = Array.from(this.costs.subarray(0, n)).sort((a, b) => a - b);
    const cadence = times[Math.floor(n * .2)];
    const budget = 1000 / cfg.targetFps;
    const cost = costs[Math.floor(n * .75)];
    const missed = times.filter(t => t > budget * cfg.missedFrameRatio).length / n;
    this.stats = {
      fps: 1000 * n / times.reduce((a, b) => a + b, 0),
      cadenceHz: 1000 / cadence, workMs: cost, missRatio: missed,
    };

    // Stable low-rate RAF with cheap draws can be Android's battery/refresh policy.
    // It cannot reliably be distinguished from a stable GPU cap using Canvas 2D.
    const osLimited = times[Math.floor(n * .9)] / cadence < cfg.stableRatio && cost < budget * cfg.osLimitedCost;
    const pressure = cost > budget * cfg.busyCost || (missed > cfg.busyMisses && !osLimited);
    this.slow = pressure ? this.slow + 1 : 0;
    this.healthy = !pressure && missed < cfg.healthyMisses && cost < budget * cfg.healthyCost ? this.healthy + this.span : 0;
    this.span = this.count = 0;
    if (now - this.changedAt < cfg.cooldownMs) return false;

    let next = this.scale;
    if (this.slow >= cfg.busyWindows) next = Math.max(cfg.minScale, this.scale - cfg.scaleStep);
    else if (this.healthy >= cfg.recoverMs) next = Math.min(1, this.scale + cfg.scaleStep);
    if (next === this.scale) return false;
    this.scale = next;
    this.changes++;
    this.changedAt = now;
    this.reset(now);
    return true;
  }

  snapshot() { return { ...this.stats, scale: this.scale, changes: this.changes }; }
}
