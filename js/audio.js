import { CONFIG } from './config.js';

export function noteFrequency(index = 0) {
  const position = Number.isFinite(index) ? Math.max(0, Math.min(CONFIG.audio.noteHz.length - 1, Math.floor(index))) : 0;
  return CONFIG.audio.noteHz[position];
}

export class Audio {
  constructor() { this.context = null; this.master = null; this.voices = new Map(); }

  unlock() {
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = CONFIG.audio.volume;
        this.master.connect(this.context.destination);
      }
      this.resume();
    } catch { /* Audio is optional; the visual game stays playable. */ }
  }

  resume() {
    if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
  }

  pause() {
    for (const [voice, envelope] of this.voices) this.release(voice, envelope);
    if (this.context?.state === 'running') this.context.suspend().catch(() => {});
  }

  release(voice, envelope, stop = true) {
    if (stop) { try { voice.stop(); } catch { /* Already ended. */ } }
    voice.disconnect(); envelope.disconnect();
    this.voices.delete(voice);
  }

  tone(from, to, seconds, type = 'sine', delay = 0, level = 1) {
    if (!this.context || this.context.state === 'closed') return;
    try {
      while (this.voices.size >= CONFIG.audio.maxVoices) {
        // Disconnect immediately: onended may not fire while audio is suspended.
        this.release(...this.voices.entries().next().value);
      }
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const start = this.context.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(to, start + seconds);
      envelope.gain.setValueAtTime(CONFIG.audio.floorGain, start);
      envelope.gain.linearRampToValueAtTime(Math.min(1, Math.max(CONFIG.audio.floorGain, level)), start + CONFIG.audio.attackSeconds);
      envelope.gain.exponentialRampToValueAtTime(CONFIG.audio.floorGain, start + seconds);
      oscillator.connect(envelope); envelope.connect(this.master);
      this.voices.set(oscillator, envelope);
      oscillator.onended = () => this.release(oscillator, envelope, false);
      oscillator.start(start); oscillator.stop(start + seconds);
    } catch { /* A device can revoke audio while backgrounding. */ }
  }

  play(event) {
    if (!event) return;
    const a = CONFIG.audio;
    if (event.type === 'turn') this.tone(...a.turnHz, a.turnSeconds, 'triangle', 0, 0.42);
    if (event.type === 'stumble') {
      this.tone(...a.stumbleHz, a.stumbleSeconds, 'triangle', 0, 0.65);
      this.tone(280, 200, 0.13, 'sine', 0.1, 0.2);
    }
    if (event.type === 'land') {
      this.tone(...a.landingHz, a.landingSeconds, 'sine', 0, 0.38);
      this.tone(360, 180, 0.035, 'triangle', 0, 0.13);
    }
    if (event.type === 'jump') {
      const note = noteFrequency(event.noteIndex);
      this.tone(note * 0.82, note, a.jumpSeconds, 'triangle', 0, 0.75);
      this.tone(note * 2, note * 2, a.coinSeconds, 'sine', 0.015, 0.28);
      if (event.bonus) {
        a.comboSemitones.forEach((semitone, index) => {
          const hz = noteFrequency(0) * 2 * 2 ** (semitone / 12);
          this.tone(hz, hz, 0.23, 'sine', index * a.comboSpacingSeconds, 0.48);
        });
      }
    }
  }
}
