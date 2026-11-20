import { CONFIG } from './config.js';
import { normalizeProgress } from './campaign.js';

export const BASE_AVATAR = Object.freeze({ head: 'pilot', body: 'coral', back: 'none' });
export const AVATAR_PALETTE = Object.freeze({ helmet: '#39cbd6', helmetTop: '#a2fff1', helmetSide: '#248eab', shirt: '#ff7c64', shirtTop: '#ffa58a', shirtSide: '#bd505b' });

export class Profile {
  constructor(storage) {
    this.storage = storage;
    this.status = 'saved';
    this.data = { version: CONFIG.arcade.storageVersion, coins: 0, equipped: { ...BASE_AVATAR }, owned: Object.values(BASE_AVATAR),progress:normalizeProgress() };
    try {
      if (storage === undefined) this.storage = globalThis.localStorage;
      const raw = this.storage?.getItem(CONFIG.arcade.storageKey);
      if (raw) {
        if(raw.length>CONFIG.campaign.maxSaveBytes)throw new Error('Oversized profile');
        const saved = JSON.parse(raw);
        if (![1,CONFIG.arcade.storageVersion].includes(saved?.version)) throw new Error('Unknown profile version');
        if (Number.isSafeInteger(saved.coins) && saved.coins >= 0) this.data.coins = Math.min(saved.coins, CONFIG.arcade.maxCoins);
        // Only released parts can be equipped; expand this catalog with the shop release.
        for (const [slot, base] of Object.entries(BASE_AVATAR)) {
          if (saved.equipped?.[slot] === base && Array.isArray(saved.owned) && saved.owned.includes(base)) this.data.equipped[slot] = base;
        }
        this.data.progress=normalizeProgress(saved.progress);
      }
      if (!this.storage) this.status = 'memory';
    } catch { this.status = this.storage ? 'recovered' : 'memory'; }
  }
  get coins() { return this.data.coins; }
  get equipped() { return { ...this.data.equipped }; }
  get palette() { return AVATAR_PALETTE; }
  credit(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
    const added = Math.min(amount, CONFIG.arcade.maxCoins - this.data.coins);
    this.data.coins += added;
    this.save();
    return added;
  }
  save() {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(CONFIG.arcade.storageKey, JSON.stringify(this.data));
      this.status = 'saved'; return true;
    } catch { this.status = 'memory'; return false; }
  }
  commitBattle(progress,checkpoint,coins=0) {
    if(!Number.isSafeInteger(coins)||coins<0)return false;
    // One document commits the receipt and its matching world state atomically.
    this.data.coins=Math.min(CONFIG.arcade.maxCoins,this.data.coins+coins);
    this.data.progress.battle=JSON.parse(JSON.stringify({...progress,checkpoint}));
    return this.save();
  }
  snapshot() { return { ...JSON.parse(JSON.stringify(this.data)), status: this.status }; }
}
