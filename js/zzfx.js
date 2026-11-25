/*!
 * ZzFX - Zuper Zmall Zound Zynth v1.4.0 by Frank Force
 * https://github.com/KilledByAPixel/ZzFX
 * MIT License - Copyright (c) 2019 - Frank Force
 */

export const ZZFX = {
  volume: 0.3,
  sampleRate: 44100,

  buildSamples(
    volume = 1,
    randomness = 0.05,
    frequency = 220,
    attack = 0,
    sustain = 0,
    release = 0.1,
    shape = 0,
    shapeCurve = 1,
    slide = 0,
    deltaSlide = 0,
    pitchJump = 0,
    pitchJumpTime = 0,
    repeatTime = 0,
    noise = 0,
    modulation = 0,
    bitCrush = 0,
    delay = 0,
    sustainVolume = 1,
    decay = 0,
    tremolo = 0,
    filter = 0
  ) {
    let sampleRate = this.sampleRate,
      PI2 = Math.PI * 2,
      abs = Math.abs,
      sign = v => (v < 0 ? -1 : 1),
      startSlide = (slide *= (500 * PI2) / sampleRate / sampleRate),
      startFrequency = (frequency *= ((1 + randomness * 2 * Math.random() - randomness) * PI2) / sampleRate),
      modOffset = 0,
      repeat = 0,
      crush = 0,
      jump = 1,
      length,
      b,
      t = 0,
      i = 0,
      s = 0,
      f,
      quality = 2,
      w = (PI2 * abs(filter) * 2) / sampleRate,
      cos = Math.cos(w),
      alpha = Math.sin(w) / 2 / quality,
      a0 = 1 + alpha,
      a1 = (-2 * cos) / a0,
      a2 = (1 - alpha) / a0,
      b0 = (1 + sign(filter) * cos) / 2 / a0,
      b1 = -(sign(filter) + cos) / a0,
      b2 = b0,
      x2 = 0,
      x1 = 0,
      y2 = 0,
      y1 = 0;

    const minAttack = 9;
    attack = attack * sampleRate || minAttack;
    decay *= sampleRate;
    sustain *= sampleRate;
    release *= sampleRate;
    delay *= sampleRate;
    deltaSlide *= (500 * PI2) / sampleRate ** 3;
    modulation *= PI2 / sampleRate;
    pitchJump *= PI2 / sampleRate;
    pitchJumpTime *= sampleRate;
    repeatTime = (repeatTime * sampleRate) | 0;

    length = (attack + decay + sustain + release + delay) | 0;
    b = new Float32Array(length > 0 ? length : 0);

    for (; i < length; b[i++] = s * volume) {
      if (!(++crush % ((bitCrush * 100) | 0))) {
        s = shape
          ? shape > 1
            ? shape > 2
              ? shape > 3
                ? shape > 4
                  ? (t / PI2) % 1 < shapeCurve / 2
                    ? 1
                    : -1
                  : Math.sin(t ** 3)
                : Math.max(Math.min(Math.tan(t), 1), -1)
              : 1 - (((2 * t) / PI2) % 2 + 2) % 2
            : 1 - 4 * abs(Math.round(t / PI2) - t / PI2)
          : Math.sin(t);

        s =
          (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) *
          (shape > 4 ? s : sign(s) * abs(s) ** shapeCurve) *
          (i < attack
            ? i / attack
            : i < attack + decay
            ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
            : i < attack + decay + sustain
            ? sustainVolume
            : i < length - delay
            ? ((length - i - delay) / release) * sustainVolume
            : 0);

        s = delay
          ? s / 2 +
            (delay > i
              ? 0
              : (i < length - delay ? 1 : (length - i) / delay) * b[(i - delay) | 0] / 2 / volume)
          : s;

        if (filter) s = y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
      }

      f = (frequency += slide += deltaSlide) * Math.cos(modulation * modOffset++);
      t += f + f * noise * (((i * i * PI2) % 2) - 1);

      if (jump && ++jump > pitchJumpTime) {
        frequency += pitchJump;
        startFrequency += pitchJump;
        jump = 0;
      }

      if (repeatTime && !(++repeat % repeatTime)) {
        frequency = startFrequency;
        slide = startSlide;
        jump ||= 1;
      }
    }

    return b;
  },

  getNote(semitoneOffset = 0, rootNoteFrequency = 440) {
    return rootNoteFrequency * 2 ** (semitoneOffset / 12);
  },
};

// Pre-designed ZzFX Arcade Sound Presets (deterministic randomness = 0 for repeatable caching)
export const ZZFX_PRESETS = Object.freeze({
  armorBreak: [0.55, 0, 195, 0.005, 0.03, 0.11, 4, 1.4, -4.5, 0, 0, 0, 0, 0.8, 18, 0.15, 0, 0.55, 0.02, 0, 2400],
  stompBounce: [0.6, 0, 260, 0.004, 0.04, 0.14, 1, 1.2, 8.5, 0, 140, 0.035, 0, 0.1, 0, 0, 0, 0.75, 0.02, 0, 0],
  boosterUp: [0.55, 0, 523.25, 0.005, 0.06, 0.16, 1, 1.1, 3.2, 0, 261.63, 0.045, 0, 0, 0, 0, 0.03, 0.8, 0.02, 0, 0],
  bossExplode: [0.7, 0, 92, 0.01, 0.08, 0.28, 4, 1.7, -1.8, 0, 0, 0, 0, 1.1, 12, 0.25, 0.04, 0.65, 0.04, 0, 950],
  coreLock: [0.5, 0, 659.25, 0.004, 0.05, 0.15, 0, 1, 0, 0, 329.63, 0.04, 0, 0, 0, 0, 0.025, 0.82, 0.02, 0, 0],
});
