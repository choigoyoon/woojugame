const freeze = (object) => {
  for (const value of Object.values(object)) {
    if (value && typeof value === 'object') freeze(value);
  }
  return Object.freeze(object);
};

export const ACTION = Object.freeze({ TURN: 'turn', CLIMB: 'climb' });
export const MODE = Object.freeze({
  PLAYING: 'playing', STUMBLE: 'stumble',
  BRAKE_WARNING: 'brake-warning', BRAKE_HOLD: 'brake-hold',
  AUTO_CLIMB: 'auto-climb', PUZZLE: 'puzzle', SHOP: 'shop',
});

export const CONFIG = freeze({
  features: { brake: true, puzzle: true, battle: true, shop: false, persistence: true, cooldown: false, pwa: false },
  arcade: { homeIdleMs: 800, maxFrameMs: 100, storageKey: 'uju-arcade-profile', storageVersion: 2, maxCoins: 999999999 },
  campaign: {
    checkpointVersion: 1, saveMs: 1000, resultGuardMs: 800, stableChoiceMs: 900, sampleCount: 10,
    gateEveryMs: 22000, gateFirstMs:5000, gateReserveMs:16000, assistedGateSpeed:.75,
    extraSupplyMs: 30000, maxSaveBytes: 262144, bossSafeX:.35,
    math:{maxOperands:[10,20,20],minGaps:[3,3,1],promoteWins:8,demoteWins:5},
    rounds: [
      {id:'harbor-1',title:'선착장 돌격',boss:'철통 대장',durationMs:120000,enemyEveryMs:6500,patterns:[0,1,0,1],squad:5,reward:40,bossSeconds:8,warningMs:1500,theme:0},
      {id:'harbor-2',title:'화물선 추격',boss:'쌍둥이 집게',durationMs:130000,enemyEveryMs:6000,patterns:[1,2,0,2],squad:8,reward:60,bossSeconds:10,warningMs:1400,theme:1},
      {id:'harbor-3',title:'항구를 지켜라',boss:'항구 수호 거인',durationMs:140000,enemyEveryMs:5500,patterns:[2,1,0,2],squad:10,reward:100,bossSeconds:12,warningMs:1300,theme:2},
    ],
    weapons: {
      pulse:{name:'펄스포',color:'#ffd277'},
      spread:{name:'확산포',color:'#8cffe0'},
      pierce:{name:'관통포',color:'#cdb3ff'},
      arc:{name:'연쇄포',color:'#9bdcff'},
    },
    spreadDamage:.7, spreadInterval:1.12, spreadWidth:.25,
    pierceTargets:2, arcDamage:.8, arcSplash:.5, arcRangeX:.75, arcRangeZ:3, rankBonus:.18,
  },
  brake: { minSteps: 15, maxSteps: 25, warningMs: 500, holdMs: 2000, coins: 15, autoSteps: 5, autoStepMs: 190 },
  puzzle: { everySteps: 50, brakeExclusionSteps: 3, chestCoins: 50, celebrationMs: 1800, wrongMs: 450 },
  battle: {
    initialSquad: 5, maxVisibleSquad: 24, spriteFrames: 16, maxSquad: 999999, penalty: 3, penaltyFraction: 0.15,
    speed: 4.8, steerSpeed: 3.8, maxX: 0.8, playerZ: 1.8,
    shotMs: 125, bulletSpeed: 42, maxBullets: 100, maxEntities: 12,
    maxPellets: 5, maxDamage: 24, particles: 160, particleMs: 850,
    gateZ: 38, gateTimes: [1000, 10000], enemyEveryMs: 3800, bossAtMs: 19000,
    bossHp: 300, bossHpPerWave: 150, bossSpawnZ: 18, bossCoins: 60, waveBreakMs: 2200,
    barrelCoins: 5, enemyCoins: 2, gateCoins: 3, hitMs: 100, maxOperand: 20,
    openingZ: 16, supplyAtMs: 4200, supplyHp: 10, supplyCoins: 3,
    chainDamage: 60, chainRadiusX: .9, chainRadiusZ: 4, comboMs: 2400,
    chargeKills: 4, powerMs: 6000, powerShotMs: 75, powerDamage: 1.35, powerMinPellets: 3,
    bossCombatSeconds: 7, bossFirstAttackMs: 900, bossWarningMs: 1100,
    bossSlamMs: 380, bossAttackGapMs: 2000, bossRageGapMs: 1400, bossPenalty: 2,
    impactCount: 24, debrisCount: 40, lootCount: 24,
    maxFrameMs: 250, fixedStepMs: 16, farZ: 48,
  },
  view: { width: 720, height: 1280, safeMinPx: 48, controlFraction: 0.22, maxDpr: 2 },
  stairs: {
    originX: 360, stepX: 112, stepY: 82, minColumn: -2, maxColumn: 2,
    ahead: 11, behind: 4, initialFacing: 1, turnChance: 0.38, openingStraightSteps: 2,
  },
  rules: { stumbleMs: 1000, stepCoins: 1, comboEvery: 10, comboCoins: 5 },
  rhythm: { chainWindowMs: 480, maxNote: 7 },
  motion: {
    anchorY: 866, clipTop: 200, hopMs: 190, minHopMs: 90, hopCadenceRatio: 0.72,
    hopHeight: 54, cameraMs: 85, maxVisualGap: 4,
    shakeMs: 110, shakePx: 4, stumbleShakePx: 8,
    particleCount: 96, particlesPerJump: 6, particlesPerLanding: 5, particlesPerCombo: 42,
    particleLifeMs: 720, particleGravity: 340, particleSpeed: 190,
    popupCount: 6, popupLifeMs: 850, pressMs: 80,
    idlePeriodMs: 2400, idleAmplitude: 2.8, blinkMinMs: 2600, blinkMaxMs: 5200, blinkMs: 150,
    landingFrequency: 27, landingDamping: 0.55, landingImpulse: 34,
    platformFrequency: 26, platformDamping: 0.52, platformImpulse: 190,
    buttonFrequency: 32, buttonDamping: 0.6, buttonDepth: 14,
    rippleCount: 12, rippleMs: 420, auraMs: 1200,
  },
  sky: {
    stratosphereStep: 80, spaceStep: 200, starCount: 56,
    colors: [
      ['#3486d8', '#73d9ee', '#d9f8e9'],
      ['#343a8f', '#8293e4', '#d2c0f1'],
      ['#0b1230', '#29235d', '#73569e'],
    ],
  },
  audio: {
    volume: 0.11, maxVoices: 12, attackSeconds: 0.006, floorGain: 0.001,
    noteHz: [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25],
    jumpSeconds: 0.13, coinSeconds: 0.11, landingHz: [150, 58], landingSeconds: 0.09,
    turnHz: [360, 230], turnSeconds: 0.045, stumbleHz: [210, 80], stumbleSeconds: 0.24,
    comboSemitones: [0, 4, 7, 12], comboSpacingSeconds: 0.06,
  },
  // Contracts reserved for the next release.
  future: {
    shop: { idleMs: 800, longPressMs: 2000, pin: '0808', normalPriceMin: 100, normalPriceMax: 300, legendaryPrice: 500, legendaryCount: 3 },
    cooldown: { afterMs: 15 * 60 * 1000 },
    pwa: { iconSizes: [192, 512], orientation: 'portrait', display: 'fullscreen' },
  },
});
