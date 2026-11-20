import { CONFIG } from './config.js';

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

  tone(from, to, seconds, type = 'sine', delay = 0) {
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
      envelope.gain.linearRampToValueAtTime(1, start + CONFIG.audio.attackSeconds);
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
    if (event.type === 'turn') this.tone(...a.turnHz, a.turnSeconds, 'triangle');
    if (event.type === 'stumble') this.tone(...a.stumbleHz, a.stumbleSeconds, 'triangle');
    if (event.type === 'jump') {
      this.tone(...a.jumpHz, a.jumpSeconds, 'triangle');
      this.tone(...a.coinHz, a.coinSeconds);
      if (event.bonus) a.comboHz.forEach((hz, index) => this.tone(hz, hz, a.coinSeconds, 'sine', index * a.comboSpacingSeconds));
    }
  }
}
