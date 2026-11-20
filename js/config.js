const freeze = (object) => {
  for (const value of Object.values(object)) {
    if (value && typeof value === 'object') freeze(value);
  }
  return Object.freeze(object);
};

export const ACTION = Object.freeze({ TURN: 'turn', CLIMB: 'climb' });
export const MODE = Object.freeze({
  PLAYING: 'playing', STUMBLE: 'stumble',
  // Reserved states only. Phase 1 never enters these states.
  BRAKE_WARNING: 'brake-warning', BRAKE_HOLD: 'brake-hold',
  AUTO_CLIMB: 'auto-climb', PUZZLE: 'puzzle', SHOP: 'shop',
});

export const CONFIG = freeze({
  features: { brake: false, puzzle: false, shop: false, persistence: false, cooldown: false, pwa: false },
  view: { width: 720, height: 1280, safeMinPx: 48, controlFraction: 0.22, maxDpr: 2 },
  stairs: {
    originX: 360, stepX: 112, stepY: 82, minColumn: -2, maxColumn: 2,
    ahead: 11, behind: 4, initialFacing: 1, turnChance: 0.38, openingStraightSteps: 2,
  },
  rules: { stumbleMs: 1000, stepCoins: 1, comboEvery: 10, comboCoins: 5 },
  motion: {
    anchorY: 866, clipTop: 200, hopMs: 115, hopHeight: 42, cameraMs: 90,
    maxFrameMs: 50, shakeMs: 110, shakePx: 4, stumbleShakePx: 8,
    particleCount: 96, particlesPerJump: 9, particlesPerCombo: 28,
    particleLifeMs: 600, particleGravity: 380, particleSpeed: 160,
    popupCount: 6, popupLifeMs: 700, pressMs: 110,
  },
  audio: {
    volume: 0.13, maxVoices: 12, attackSeconds: 0.008, floorGain: 0.001,
    jumpHz: [330, 620], jumpSeconds: 0.09, coinHz: [1047, 1568], coinSeconds: 0.11,
    turnHz: [260, 360], turnSeconds: 0.045, stumbleHz: [180, 75], stumbleSeconds: 0.22,
    comboHz: [784, 1047, 1568], comboSpacingSeconds: 0.055,
  },
  // Configuration contracts for later phases; no event, shop, save or PWA code yet.
  future: {
    brake: { minSteps: 15, maxSteps: 25, warningMs: 500, holdMs: 2000, coins: 15, autoSteps: 5 },
    puzzle: { everySteps: 50, brakeExclusionSteps: 3, chestCoins: 50 },
    shop: { idleMs: 800, longPressMs: 2000, pin: '0808', normalPriceMin: 100, normalPriceMax: 300, legendaryPrice: 500, legendaryCount: 3 },
    cooldown: { afterMs: 15 * 60 * 1000 },
    storage: { version: 1, key: 'uju-block-run' },
    pwa: { iconSizes: [192, 512], orientation: 'portrait', display: 'fullscreen' },
  },
});
