import { ACTION, CONFIG, MODE } from './config.js';
import { SCENARIOS } from './scenarios.js';
import { InputBuffer } from './engine.js';

/** Stair rules and rewards, independent of Canvas/DOM. */
export class Game {
  constructor(random = Math.random, { wallet = null, events = true } = {}) {
    this.random = random; this.wallet = wallet; this.eventsEnabled = events;
    this.events = [];this.buffer=new InputBuffer();
    this.state = {
      mode: MODE.PLAYING, paused: false, step: 0, coins: 0, combo: 0,
      facing: CONFIG.stairs.initialFacing, elapsedMs: 0, stumbleRemainingMs: 0,
      lastActionAt: null, lastClimbAt: null, rhythm: 0,
      brakeRemainingMs: 0, autoRemaining: 0,
      nextBrake: 0, nextPuzzle: CONFIG.puzzle.everySteps, pendingPuzzle: false, puzzle: null,
      future: { shop: null, cooldown: null },
    };
    this.metrics = { received: 0, accepted: 0, blocked: 0 };
    this.steps = [{ id: 0, column: 0, x: CONFIG.stairs.originX, y: 0 }];
    this.pathDirection = CONFIG.stairs.initialFacing;
    while (this.steps.length <= CONFIG.stairs.ahead) this.appendStep();
    this.scheduleBrake();
  }
  appendStep(recycled = {}) {
    const last = this.steps.at(-1); const nextId = last.id + 1;
    const { minColumn, maxColumn, turnChance, openingStraightSteps, stepX, stepY, originX } = CONFIG.stairs;
    if (nextId > openingStraightSteps && this.random() < turnChance) this.pathDirection *= -1;
    if (last.column + this.pathDirection > maxColumn) this.pathDirection = -1;
    if (last.column + this.pathDirection < minColumn) this.pathDirection = 1;
    Object.assign(recycled, { id: nextId, column: last.column + this.pathDirection, x: originX + (last.column + this.pathDirection) * stepX, y: -nextId * stepY });
    this.steps.push(recycled);
  }
  get current() { return this.steps.find((step) => step.id === this.state.step); }
  get next() { return this.steps.find((step) => step.id === this.state.step + 1); }
  get nextDirection() { return Math.sign(this.next.x - this.current.x); }
  get expression() { return this.state.mode === MODE.STUMBLE ? 'dizzy' : this.state.combo >= CONFIG.rules.comboEvery ? 'star' : 'smile'; }
  reward(coins) { this.state.coins += coins; this.wallet?.credit(coins); }
  takeEvents() { return this.events.splice(0); }
  scheduleBrake() {
    const s = this.state;
    const candidate = s.step + CONFIG.brake.minSteps + Math.floor(this.random() * (CONFIG.brake.maxSteps - CONFIG.brake.minSteps + 1));
    const edge = s.nextPuzzle - CONFIG.puzzle.brakeExclusionSteps;
    s.nextBrake = s.step >= edge || candidate >= edge && candidate <= s.nextPuzzle ? null : candidate;
  }
  openPuzzle() {
    const s = this.state;
    const scenario = SCENARIOS[(Math.floor(s.nextPuzzle / CONFIG.puzzle.everySteps) - 1) % SCENARIOS.length];
    const choices = [...scenario.choices];
    if (this.random() < 0.5) choices.reverse();
    s.mode = MODE.PUZZLE; s.pendingPuzzle = false;
    s.puzzle = { id: scenario.id, choices, solved: false, celebrationMs: 0, wrongMs: 0, wrongIndex: -1 };
    this.events.push({ type: 'puzzle', scenario: scenario.id, speech: scenario.speech });
  }
  choose(index) {
    const s = this.state; const p = s.puzzle;
    if (s.paused || s.mode !== MODE.PUZZLE || p.solved || ![0, 1].includes(index)) return null;
    const scenario = SCENARIOS.find((item) => item.id === p.id);
    if (p.choices[index] !== scenario.answer) {
      p.wrongMs = CONFIG.puzzle.wrongMs; p.wrongIndex = index;
      return { type: 'puzzle-miss' };
    }
    p.solved = true; p.celebrationMs = CONFIG.puzzle.celebrationMs; p.wrongMs = 0;
    this.reward(CONFIG.puzzle.chestCoins);
    return { type: 'puzzle-win', coins: CONFIG.puzzle.chestCoins };
  }
  advance(deltaMs) {
    const s = this.state;
    if (s.paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    s.elapsedMs += deltaMs;
    let left = deltaMs;
    // Consume transitions at exact boundaries, including the five automatic hops.
    while (left > 0) {
      if (s.mode === MODE.STUMBLE) {
        const used = Math.min(left, s.stumbleRemainingMs); left -= used; s.stumbleRemainingMs -= used;if(s.stumbleRemainingMs<1e-7)s.stumbleRemainingMs=0;
        if (!s.stumbleRemainingMs) s.mode = MODE.PLAYING; else break;
      } else if ([MODE.BRAKE_WARNING, MODE.BRAKE_HOLD, MODE.AUTO_CLIMB].includes(s.mode)) {
        const used = Math.min(left, s.brakeRemainingMs); left -= used; s.brakeRemainingMs -= used;if(s.brakeRemainingMs<1e-7)s.brakeRemainingMs=0;
        if (s.brakeRemainingMs > 0) break;
        if (s.mode === MODE.BRAKE_WARNING) {
          s.mode = MODE.BRAKE_HOLD; s.brakeRemainingMs = CONFIG.brake.holdMs;
          this.events.push({ type: 'brake-hold' });
        } else if (s.mode === MODE.BRAKE_HOLD) {
          this.wallet?.addStats({brakes:1,brakeWins:1},false);this.reward(CONFIG.brake.coins); s.mode = MODE.AUTO_CLIMB;
          s.autoRemaining = CONFIG.brake.autoSteps; s.brakeRemainingMs = CONFIG.brake.autoStepMs;
          this.events.push({ type: 'brake-win', coins: CONFIG.brake.coins });
        } else if (s.autoRemaining > 0) {
          s.facing = this.nextDirection;
          this.events.push(this.move(true)); s.autoRemaining -= 1;
          s.brakeRemainingMs = CONFIG.brake.autoStepMs;
          if (s.step >= s.nextPuzzle) s.pendingPuzzle = true;
        } else {
          if (s.pendingPuzzle) this.openPuzzle();
          else { s.mode = MODE.PLAYING; this.scheduleBrake(); }
        }
      } else if (s.mode === MODE.PUZZLE) {
        const p = s.puzzle;
        p.wrongMs = Math.max(0, p.wrongMs - left);
        if (p.solved) {
          p.celebrationMs = Math.max(0, p.celebrationMs - left);
          if (!p.celebrationMs) {
            s.nextPuzzle += CONFIG.puzzle.everySteps; s.puzzle = null; s.mode = MODE.PLAYING;
            this.scheduleBrake(); this.events.push({ type: 'puzzle-exit' });
          }
        }
        break;
      } else break;
    }
    this.flushBuffer();
  }
  flushBuffer(){
    if(this.state.mode!==MODE.PLAYING)return;
    let action;while((action=this.buffer.take(this.state.elapsedMs))!==null){const event=this.act(action);if(event)this.events.push(event);}
  }
  setPaused(paused) {
    const wasPaused = this.state.paused;
    this.state.paused = Boolean(paused);
    if (paused) { this.buffer.clear();this.state.lastClimbAt = null; this.state.rhythm = 0; }
    if (wasPaused && !paused && [MODE.BRAKE_HOLD, MODE.BRAKE_WARNING].includes(this.state.mode)) {
      this.state.mode = MODE.BRAKE_WARNING; this.state.brakeRemainingMs = CONFIG.brake.warningMs;
      this.events.push({ type: 'brake-warning' });
    }
  }
  stumble(brake = false) {
    const s = this.state;const brakeFailure=brake&&s.mode===MODE.BRAKE_HOLD;
    s.mode = MODE.STUMBLE; s.stumbleRemainingMs = CONFIG.rules.stumbleMs;
    s.combo = 0; s.rhythm = 0; s.lastClimbAt = null;
    if(brakeFailure)this.wallet?.addStats({brakes:1});
    if (brake) this.scheduleBrake();
    return { type: 'stumble', x: this.current.x, y: this.current.y };
  }
  move(auto = false) {
    const s = this.state; const from = { x: this.current.x, y: this.current.y };
    s.step += 1;
    let bonus = 0; let intervalMs = null;
    if (!auto) {
      s.combo += 1; intervalMs = s.lastClimbAt === null ? null : s.elapsedMs - s.lastClimbAt;
      s.rhythm = intervalMs !== null && intervalMs <= CONFIG.rhythm.chainWindowMs ? Math.min(s.rhythm + 1, CONFIG.rhythm.maxNote + 1) : 1;
      s.lastClimbAt = s.elapsedMs;
      bonus = s.combo % CONFIG.rules.comboEvery === 0 ? CONFIG.rules.comboCoins : 0;
      this.reward(CONFIG.rules.stepCoins + bonus);
    }
    const event = { type: 'jump', from, x: this.current.x, y: this.current.y, bonus, auto,
      step: s.step, combo: s.combo, direction: s.facing, noteIndex: auto ? 5 : s.rhythm - 1, intervalMs };
    while (this.steps.at(-1).id < s.step + CONFIG.stairs.ahead) {
      this.appendStep(this.steps[0].id < s.step - CONFIG.stairs.behind ? this.steps.shift() : {});
    }
    return event;
  }
  act(action) {
    const s = this.state;
    if (![ACTION.TURN, ACTION.CLIMB].includes(action)) return null;
    this.metrics.received += 1;
    if (s.paused || ![MODE.PLAYING, MODE.BRAKE_WARNING, MODE.BRAKE_HOLD].includes(s.mode)) {
      if(!s.paused&&s.mode===MODE.STUMBLE&&s.stumbleRemainingMs<=CONFIG.engine.bufferMs)this.buffer.push(action,s.elapsedMs);
      this.metrics.blocked += 1; return null;
    }
    this.metrics.accepted += 1; s.lastActionAt = s.elapsedMs;
    if (s.mode === MODE.BRAKE_HOLD) return this.stumble(true);
    if (action === ACTION.TURN) { s.facing *= -1; return { type: 'turn' }; }
    if (s.facing !== this.nextDirection) return this.stumble(s.mode === MODE.BRAKE_WARNING);
    const event = this.move();
    if (this.eventsEnabled) {
      if (s.step >= s.nextPuzzle) this.openPuzzle();
      else if (s.mode === MODE.PLAYING && s.nextBrake !== null && s.step >= s.nextBrake && s.nextPuzzle - s.step > CONFIG.puzzle.brakeExclusionSteps) {
        s.mode = MODE.BRAKE_WARNING; s.brakeRemainingMs = CONFIG.brake.warningMs;
        this.events.push({ type: 'brake-warning' });
      }
    }
    return event;
  }
  snapshot() {
    return { ...this.state, puzzle: this.state.puzzle ? { ...this.state.puzzle, choices: [...this.state.puzzle.choices] } : null,
      expression: this.expression, future: { ...this.state.future }, nextDirection: this.nextDirection,
      current: { ...this.current }, next: { ...this.next }, stepObjects: this.steps.length, metrics: { ...this.metrics } };
  }
}
