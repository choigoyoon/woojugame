import { CONFIG } from './config.js';
import { Game } from './game.js';
import { CampaignBattle } from './campaign.js';

// An input callback can precede a RAF callback with an older frame timestamp.
// Never move this cursor backwards or the same interval would be simulated twice.
export class FrameClock {
  constructor(now = 0) { this.last = now; }
  reset(now) { this.last = now; }
  tick(now) {
    if (!Number.isFinite(now)) return 0;
    const current = Math.max(this.last, now);
    const delta = Math.min(CONFIG.arcade.maxFrameMs, current - this.last);
    this.last = current;
    return delta;
  }
}

export class Arcade {
  constructor(profile, random = Math.random) {
    this.profile = profile; this.mode = 'lobby'; this.clock = 0; this.lastInputAt = -Infinity; this.paused = false;
    this.stairs = new Game(random, { wallet: profile }); this.battle = new CampaignBattle(random, profile);
    this.stairs.setPaused(true); this.battle.setPaused(true);
  }
  interact() { this.lastInputAt = this.clock; }
  canHome(held = false) { return !held && this.clock - this.lastInputAt >= CONFIG.arcade.homeIdleMs; }
  enter(mode) {
    if (this.mode !== 'lobby' || !['stairs', 'battle', 'profile'].includes(mode)) return false;
    this.mode = mode; this.interact();
    this.syncPaused(); return true;
  }
  home(held = false) {
    if (this.mode === 'lobby' || (this.mode !== 'profile' && !this.canHome(held))) return false;
    this.mode = 'lobby'; this.syncPaused(); this.profile.save(); return true;
  }
  setPaused(paused) { this.paused = Boolean(paused); this.syncPaused(); }
  syncPaused() {
    this.stairs.setPaused(this.paused || this.mode !== 'stairs');
    this.battle.setPaused(this.paused || this.mode !== 'battle');
  }
  advance(ms) {
    if (this.paused || !Number.isFinite(ms) || ms < 0) return;
    this.clock += ms;
    if (this.mode === 'stairs') this.stairs.advance(ms);
    if (this.mode === 'battle') this.battle.advance(ms);
  }
}
