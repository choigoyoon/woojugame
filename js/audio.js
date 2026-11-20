import { CONFIG } from './config.js';

export function noteFrequency(index = 0) {
  const position = Number.isFinite(index) ? Math.max(0, Math.min(CONFIG.audio.noteHz.length - 1, Math.floor(index))) : 0;
  return CONFIG.audio.noteHz[position];
}

export class Audio {
  constructor() { this.context = null; this.master = null; this.voices = new Map(); this.speechToken = 0; this.noiseBuffer=null;this.lastImpact=-Infinity; }

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
    this.stopEffects();
    if (this.context?.state === 'running') this.context.suspend().catch(() => {});
  }

  stopEffects() {
    this.cancelSpeech();
    for (const [voice, envelope] of this.voices) this.release(voice, envelope);
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

  noise(seconds, level = .3) {
    if(!this.context||this.context.state==='closed')return;
    try {
      if(!this.noiseBuffer){
        this.noiseBuffer=this.context.createBuffer(1,Math.ceil(this.context.sampleRate*.5),this.context.sampleRate);
        const samples=this.noiseBuffer.getChannelData(0);let low=0;
        for(let i=0;i<samples.length;i++){const white=Math.random()*2-1;low=.83*low+.17*white;samples[i]=white*.35+low*1.8;}
      }
      while(this.voices.size>=CONFIG.audio.maxVoices)this.release(...this.voices.entries().next().value);
      const voice=this.context.createBufferSource(),envelope=this.context.createGain(),now=this.context.currentTime;
      voice.buffer=this.noiseBuffer;envelope.gain.setValueAtTime(CONFIG.audio.floorGain,now);
      envelope.gain.linearRampToValueAtTime(level,now+.004);envelope.gain.exponentialRampToValueAtTime(CONFIG.audio.floorGain,now+seconds);
      voice.connect(envelope);envelope.connect(this.master);this.voices.set(voice,envelope);
      voice.onended=()=>this.release(voice,envelope,false);voice.start(now);voice.stop(now+seconds);
    }catch{/* Optional percussion must never interrupt a frame. */}
  }

  play(event) {
    if (!event) return;
    const a = CONFIG.audio;
    if (event.type === 'shot') {
      this.tone(event.powered?740:340,event.powered?170:72,event.powered?.075:.065,event.powered?'sawtooth':'square',0,event.powered?.18:.16);
      this.noise(.035,event.powered?.23:.17);
    }
    if (event.type === 'boss') { this.tone(120,60,.35,'sawtooth',0,.3);this.tone(523,262,.2,'triangle',.2,.22); }
    if (event.type === 'hit'&&(this.context?.currentTime??0)-this.lastImpact>=.035) {
      this.lastImpact=this.context?.currentTime??0;
      this.tone(530+(event.crack??0)*100,145,.065,'triangle',0,.35);this.noise(.04,.22);
    }
    if(event.type==='armor-break'){this.noise(.11,.45);this.tone(860,280,.12,'square',0,.19);}
    if(event.type==='power-up'){
      [392,523,784,1046].forEach((hz,i)=>this.tone(hz*.5,hz,.18,'sawtooth',i*.055,.25));
      this.tone(80,190,.28,'sine',0,.5);
    }
    if(event.type==='boss-warning')for(const delay of[0,.18])this.tone(740,880,.12,'triangle',delay,.45);
    if(event.type==='boss-rage'){this.tone(180,80,.3,'sawtooth',0,.4);this.noise(.2,.3);}
    if(event.type==='boss-slam'){this.noise(.2,.45);this.tone(110,36,.24,'sine',0,.7);if(!event.hit)this.tone(880,1320,.13,'sine',.08,.35);}
    if (event.type === 'explode') {
      this.noise(event.boss?.45:.25,event.boss?.75:.5);
      this.tone(180, 36, event.boss ? 0.42 : 0.22, 'sawtooth', 0, 0.27);
      this.tone(80, 34, 0.27, 'sine', 0, 0.65);
      if (event.boss) this.play({ type: 'reward' });
    }
    if (['select', 'wave'].includes(event.type)) this.tone(523, 784, 0.12, 'triangle', 0, 0.45);
    if (['gate-miss', 'bump', 'puzzle-miss', 'locked'].includes(event.type)) this.tone(320, 190, 0.13, 'triangle', 0, 0.4);
    if (['reward', 'gate-win', 'puzzle-win', 'brake-win'].includes(event.type)) {
      if (event.type === 'puzzle-win') this.cancelSpeech();
      [523.25,659.25,783.99,1046.5].forEach((hz,i)=>this.tone(hz,hz,0.23,'sine',i*.075,.45));
    }
    if (event.type === 'brake-warning') {
      this.tone(1100, 1450, .12, 'sine', 0, .4);this.tone(1100, 1450, .14, 'sine', .17, .4);
    }
    if (event.type === 'brake-hold') this.tone(520, 390, .12, 'triangle', 0, .5);
    if (event.type === 'puzzle') this.speak(event.speech,event.scenario);
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

  cancelSpeech() {
    this.speechToken += 1;
    try { globalThis.speechSynthesis?.cancel(); } catch { /* Optional platform API. */ }
  }

  speak(text, cue = 'teacher') {
    this.cancelSpeech();
    // Every scene has a local synthesized cue, even without a Korean voice or network.
    const notes = cue === 'bell' ? [1047, 784, 1047] : cue === 'rain' ? [1700, 1300, 1900, 1100] : cue === 'friend' ? [392, 523, 659] : [880, 1175];
    notes.forEach((hz,i)=>this.tone(hz,hz*.91,cue==='rain'?.07:.21,'sine',i*.12,cue==='rain'?.12:.32));
    try {
      const synth=globalThis.speechSynthesis;
      const voice=synth?.getVoices().find((v)=>v.lang.toLowerCase().startsWith('ko')&&v.localService);
      if(!voice||!globalThis.SpeechSynthesisUtterance)return false;
      const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang='ko-KR';utterance.rate=.9;utterance.volume=.8;
      utterance.onerror=()=>{};synth.speak(utterance);return true;
    }catch{return false;}
  }
}
