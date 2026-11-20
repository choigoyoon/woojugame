import { ACTION, CONFIG, MODE } from './config.js';

/** Pure game rules: no DOM, rendering, timers or storage side effects. */
export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.state = {
      mode: MODE.PLAYING, paused: false, step: 0, coins: 0, combo: 0,
      facing: CONFIG.stairs.initialFacing, elapsedMs: 0, stumbleRemainingMs: 0,
      lastActionAt: null, lastClimbAt: null, rhythm: 0,
      future: { brake: null, puzzle: null, shop: null, cooldown: null },
    };
    this.metrics = { received: 0, accepted: 0, blocked: 0 };
    this.steps = [{ id: 0, column: 0, x: CONFIG.stairs.originX, y: 0 }];
    this.pathDirection = CONFIG.stairs.initialFacing;
    while (this.steps.length <= CONFIG.stairs.ahead) this.appendStep();
  }

  appendStep(recycled = {}) {
    const last = this.steps.at(-1);
    const nextId = last.id + 1;
    const { minColumn, maxColumn, turnChance, openingStraightSteps, stepX, stepY, originX } = CONFIG.stairs;
    if (nextId > openingStraightSteps && this.random() < turnChance) this.pathDirection *= -1;
    if (last.column + this.pathDirection > maxColumn) this.pathDirection = -1;
    if (last.column + this.pathDirection < minColumn) this.pathDirection = 1;
    recycled.id = nextId;
    recycled.column = last.column + this.pathDirection;
    recycled.x = originX + recycled.column * stepX;
    recycled.y = -nextId * stepY;
    this.steps.push(recycled);
  }

  get current() { return this.steps.find((step) => step.id === this.state.step); }
  get next() { return this.steps.find((step) => step.id === this.state.step + 1); }
  get nextDirection() { return Math.sign(this.next.x - this.current.x); }
  get expression() {
    if (this.state.mode === MODE.STUMBLE) return 'dizzy';
    return this.state.combo >= CONFIG.rules.comboEvery ? 'star' : 'smile';
  }

  advance(deltaMs) {
    if (this.state.paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.state.elapsedMs += deltaMs;
    if (this.state.mode === MODE.STUMBLE) {
      this.state.stumbleRemainingMs = Math.max(0, this.state.stumbleRemainingMs - deltaMs);
      if (this.state.stumbleRemainingMs === 0) this.state.mode = MODE.PLAYING;
    }
  }

  setPaused(paused) {
    this.state.paused = Boolean(paused);
    if (paused) { this.state.lastClimbAt = null; this.state.rhythm = 0; }
  }

  act(action) {
    if (action !== ACTION.TURN && action !== ACTION.CLIMB) return null;
    this.metrics.received += 1;
    if (this.state.paused || this.state.mode !== MODE.PLAYING) {
      this.metrics.blocked += 1;
      return null;
    }
    this.metrics.accepted += 1;
    this.state.lastActionAt = this.state.elapsedMs;
    if (action === ACTION.TURN) {
      this.state.facing *= -1;
      return { type: 'turn' };
    }
    if (this.state.facing !== this.nextDirection) {
      this.state.mode = MODE.STUMBLE;
      this.state.stumbleRemainingMs = CONFIG.rules.stumbleMs;
      this.state.combo = 0;
      this.state.rhythm = 0;
      this.state.lastClimbAt = null;
      return { type: 'stumble', x: this.current.x, y: this.current.y };
    }
    const from = { x: this.current.x, y: this.current.y };
    this.state.step += 1;
    this.state.combo += 1;
    const intervalMs = this.state.lastClimbAt === null ? null : this.state.elapsedMs - this.state.lastClimbAt;
    this.state.rhythm = intervalMs !== null && intervalMs <= CONFIG.rhythm.chainWindowMs
      ? Math.min(this.state.rhythm + 1, CONFIG.rhythm.maxNote + 1) : 1;
    this.state.lastClimbAt = this.state.elapsedMs;
    const bonus = this.state.combo % CONFIG.rules.comboEvery === 0 ? CONFIG.rules.comboCoins : 0;
    this.state.coins += CONFIG.rules.stepCoins + bonus;
    const event = {
      type: 'jump', from, x: this.current.x, y: this.current.y, bonus,
      step: this.state.step, combo: this.state.combo, direction: this.state.facing,
      noteIndex: this.state.rhythm - 1, intervalMs,
    };
    // Recycle old step objects. Memory is bounded by ahead + behind + current.
    while (this.steps.at(-1).id < this.state.step + CONFIG.stairs.ahead) {
      const recycle = this.steps[0].id < this.state.step - CONFIG.stairs.behind ? this.steps.shift() : {};
      this.appendStep(recycle);
    }
    return event;
  }

  snapshot() {
    return {
      ...this.state, expression: this.expression, future: { ...this.state.future }, nextDirection: this.nextDirection,
      current: { ...this.current }, next: { ...this.next },
      stepObjects: this.steps.length, metrics: { ...this.metrics },
    };
  }
}
