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
  features: { brake: true, puzzle: true, battle: true, shop: true, runner: true, plaza: true, persistence: true, cooldown: false, pwa: true },
  arcade: { homeIdleMs: 800, maxFrameMs: 50, storageKey: 'uju-arcade-profile', storageVersion: 4, maxCoins: 999999999 },
  engine: { stepMs: 5, bufferMs: 100, hurtScale: .85, collectScale: 1.2 },
  runner: { speed: 210, maxSpeed: 270, gravity: 1850, heldGravity: 1050, jumpVelocity: 690, cutVelocity: 260, holdMs: 220, coyoteMs: 100, groundY: 870, playerX: 180, playerWidth: 54, playerHeight: 135, goldMs: 5000, wordCoins: 5, sentenceCoins: 30, itemLimit: 24, spawnMs: 1650 },
  plaza: { speed: 2.65, radius: .27, itemRadius: .22, hazardRadius: .35, joystickRadius: 85, reward: 50, introMs: 1600, resultMs: 800, itemLimit: 24, hazardLimit: 3 },
  shop: { normalPrices: { visor:100,cat:220,mint:150,armor:300,cape:150,jet:300 }, legendaryPrice:500 },
  parent: { maxAttempts: 5, lockMs: 30000, sessionMs: 5 * 60 * 1000 },
  campaign: {
    checkpointVersion: 2, saveMs: 1000, resultGuardMs: 800, stableChoiceMs: 900, sampleCount: 10,
    gateEveryMs: 30000, gateFirstMs:18000, gateReserveMs:16000, assistedGateSpeed:.75,
    extraSupplyMs: 30000, maxSaveBytes: 262144, bossSafeX:.35,
    math:{maxOperands:[10,20,20],minGaps:[3,3,1],promoteWins:8,demoteWins:5},
    rounds: [
      {id:'harbor-1',title:'선착장 돌격',boss:'철통 대장',durationMs:120000,enemyEveryMs:6500,patterns:[0,1,0,1],squad:5,reward:40,bossHp:600,bossSeconds:8,warningMs:1500,theme:0},
      {id:'harbor-2',title:'화물선 추격',boss:'쌍둥이 집게',durationMs:130000,enemyEveryMs:6000,patterns:[1,2,0,2],squad:8,reward:60,bossHp:900,bossSeconds:10,warningMs:1400,theme:1},
      {id:'harbor-3',title:'항구를 지켜라',boss:'항구 수호 거인',durationMs:140000,enemyEveryMs:5500,patterns:[2,1,0,2],squad:10,reward:100,bossHp:1200,bossSeconds:12,warningMs:1300,theme:2},
    ],
    weapons: {
      pulse:{name:'펄스포',color:'#ffd277'},
      spread:{name:'확산포',color:'#8cffe0'},
      pierce:{name:'관통포',color:'#cdb3ff'},
      arc:{name:'연쇄포',color:'#9bdcff'},
    },
    spreadDamage:.7, spreadInterval:1.12, spreadWidth:.25,
    pierceTargets:2, pierceDamage:.85, arcDamage:.8, arcSplash:.5, arcRangeX:.75, arcRangeZ:3, rankBonus:.18,
    baseDps:12, memberDps:2, maxDps:360,
    sectionFractions:[0,.34,.68], sectionNames:['선착장 진입','수송로 돌파','대장에게 접근'],
    sectionPatterns:[[0,1],[1,2],[2,0,1]],
  },
  harbor: {
    version:1, disabledAtMs:1e9, maxSquad:99, gateTimes:[18000,50000], laneHoldMs:100,
    bossTimes:[75000,95000,110000], lockHp:[18,24,30], lockX:.72, lockRadius:.15,
    warningMs:1500, invulnerableMs:1000, weakMs:1500, weakDamage:1.5,
    supplyZ:30, supplyRadius:.3, crew:5, shieldGrant:2, maxShields:4, signalMs:3000,
    chainMedal:4, cargoMedal:2, enemyHp:[24,32,40], cargoHp:18,
    routes:['기차 선로','화물 선로'],
    goals:['기관차를 내려줘!','짐칸을 되찾자!','별빛특급 출발!'],
    recovered:['기관차와 코코를 구했어!','별 도장 짐칸을 찾았어!','별빛특급이 다시 달려!'],
    events:[
      [[8000,'convoy'],[29000,'row'],[34000,'warning'],[39000,'armory'],[61000,'stock'],[68000,'cargo'],[72000,'warning']],
      [[8000,'line'],[29000,'warning'],[33000,'armory'],[42000,'convoy'],[62000,'stock'],[73000,'cargo'],[81000,'weave'],[90000,'warning']],
      [[8000,'weave'],[29000,'warning'],[33000,'stock'],[42000,'line'],[61000,'armory'],[72000,'cargo'],[82000,'convoy'],[90000,'stock'],[99000,'warning']],
    ],
  },
  brake: { minSteps: 15, maxSteps: 25, warningMs: 500, holdMs: 2000, coins: 15, autoSteps: 5, autoStepMs: 190 },
  puzzle: { everySteps: 50, brakeExclusionSteps: 3, chestCoins: 50, celebrationMs: 1800, wrongMs: 450 },
  battle: {
    initialSquad: 5, maxVisibleSquad: 24, spriteFrames: 16, maxSquad: 999999, penalty: 3, penaltyFraction: 0.15,
    speed: 4.8, keyboardSteerSpeed: 2.2, steerSpeed: 3.8, maxX: 0.8, playerZ: 1.8,
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
    avatarStrideMs:115, squadFollowMs:70, squadLeanMs:95, squadMaxLean:.12, transitionMs:240,
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
  performance: {
    targetFps:60, frameToleranceMs:.25,
    minScale:.75, scaleStep:.125, windowMs:1000, warmupMs:1200, cooldownMs:4000, recoverMs:15000, maxGapMs:250,
    missedFrameRatio:1.45, stableRatio:1.15, osLimitedCost:.4, busyCost:.75, busyMisses:.08, busyWindows:2, healthyCost:.45, healthyMisses:.025,
  },
  polish: { hitStopMs: 50 },
  audio: {
    volume: 0.3, maxVoices: 20, musicVoices: 24, maxTails: 4, calmAfterMs: 15*60*1000, attackSeconds: 0.006, floorGain: 0.001,
    noteHz: [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25],
    jumpSeconds: 0.13, coinSeconds: 0.11, landingHz: [150, 58], landingSeconds: 0.09,
    turnHz: [360, 230], turnSeconds: 0.045, stumbleHz: [210, 80], stumbleSeconds: 0.24,
    comboSemitones: [0, 4, 7, 12], comboSpacingSeconds: 0.06,
  },
  // Legacy shared contracts; cooldown remains a separate product decision.
  future: {
    shop: { idleMs: 800, longPressMs: 2000, pin: '0808', normalPriceMin: 100, normalPriceMax: 300, legendaryPrice: 500, legendaryCount: 3 },
    cooldown: { afterMs: 15 * 60 * 1000 },
    pwa: { iconSizes: [192, 512], orientation: 'portrait', display: 'fullscreen' },
  },
});
