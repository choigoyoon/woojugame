import { CONFIG } from './config.js';
import { Sequencer } from './music.js';
import { ZZFX, ZZFX_PRESETS } from './zzfx.js';

export function noteFrequency(index = 0) {
  const position = Number.isFinite(index) ? Math.max(0, Math.min(CONFIG.audio.noteHz.length - 1, Math.floor(index))) : 0;
  return CONFIG.audio.noteHz[position];
}

export class Audio {
  constructor(profile=null){this.profile=profile;this.context=null;this.master=null;this.voices=new Map();this.musicVoices=new Map();this.tails=new Set();this.speechToken=0;this.noiseBuffer=null;this.lastImpact=-Infinity;this.paused=false;this.activeMs=0;this.sequencer=new Sequencer(this);this.created=0;this.ended=0;this.stolen=0;this.dropped=0;}
  attach(context){
    this.context=context;const c=context;
    this.master=c.createGain();this.master.gain.value=CONFIG.audio.volume;
    this.musicBus=c.createGain();this.musicBus.gain.value=.65;
    this.musicFilter=c.createBiquadFilter();this.musicFilter.type='lowpass';this.musicFilter.frequency.value=6500;this.musicFilter.Q.value=.5;
    this.musicBus.connect(this.musicFilter);this.musicFilter.connect(this.master);
    this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=8200;this.filter.Q.value=.5;
    this.compressor=c.createDynamicsCompressor();Object.assign(this.compressor.threshold,{value:-12});this.compressor.knee.value=8;this.compressor.ratio.value=12;this.compressor.attack.value=.003;this.compressor.release.value=.12;
    // Soft safety ceiling after the look-ahead compressor (no hard clipping).
    this.limiter=c.createWaveShaper();const curve=new Float32Array(4097);for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1,v=Math.abs(x);curve[i]=Math.sign(x)*(v<.72?v:.72+.23*Math.tanh((v-.72)/.23));}this.limiter.curve=curve;this.limiter.oversample='2x';
    this.analyser=c.createAnalyser();this.analyser.fftSize=2048;this.samples=new Float32Array(2048);
    this.master.connect(this.filter);this.filter.connect(this.compressor);this.compressor.connect(this.limiter);this.limiter.connect(this.analyser);this.analyser.connect(c.destination);
    this.noiseBuffer=c.createBuffer(1,Math.ceil(c.sampleRate*.6),c.sampleRate);const samples=this.noiseBuffer.getChannelData(0);let seed=2463534242,low=0;
    for(let i=0;i<samples.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const white=(seed>>>0)/2147483648-1;low=.8*low+.2*white;samples[i]=white*.6+low*.8;}
    this.sequencer.reset();this.applySettings();return this;
  }
  unlock(){try{if(!this.context){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;this.attach(new Context());}this.resume();}catch{/* Optional audio must never block play. */}}
  ramp(param,value,seconds=.025){if(!param||!this.context)return;const now=this.context.currentTime;param.cancelScheduledValues(now);param.setValueAtTime(param.value,now);param.linearRampToValueAtTime(value,now+seconds);}
  applySettings(){const enabled=this.profile?.data.settings.sound!==false;this.ramp(this.master?.gain,enabled&&!this.paused?CONFIG.audio.volume:0);if(!enabled){this.stopEffects();this.stopMusic();}}
  setMode(mode){const next=['stairs','battle','runner','plaza'].includes(mode)?mode:'lobby';if(next===this.sequencer.mode)return;this.stopMusic(true);this.sequencer.reset(next);}
  update(ms,playing=false){if(this.paused)return;if(playing)this.activeMs+=ms;const calm=this.activeMs>=CONFIG.audio.calmAfterMs;if(calm!==this.sequencer.calm){this.sequencer.calm=calm;this.ramp(this.musicFilter?.frequency,calm?1600:6500,2);this.ramp(this.musicBus?.gain,calm?.46:.65,2);}this.sequencer.tick();}
  resume(){this.paused=false;this.applySettings();if(this.context?.state==='suspended')this.context.resume().catch(()=>{});if(this.context&&this.sequencer.next<this.context.currentTime)this.sequencer.next=this.context.currentTime+.04;}
  pause(){this.paused=true;this.stopEffects();this.stopMusic();for(const v of [...this.tails])this.dispose(v);if(this.master){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.value=0;}if(this.context?.state==='running')this.context.suspend().catch(()=>{});}
  dispose(v){if(v.dead)return;v.dead=true;v.map.delete(v.source);this.tails.delete(v);for(const n of v.nodes){try{n.stop?.();}catch{}try{n.disconnect();}catch{}}this.ended++;}
  release(source,v,stop=true){if(!v)return;if(!stop){this.dispose(v);return;}this.dispose(v);}
  steal(v){
    this.stolen++;v.map.delete(v.source);
    if(v.start>this.context.currentTime||this.tails.size>=CONFIG.audio.maxTails){this.dispose(v);return;}
    const now=this.context.currentTime;this.tails.add(v);v.envelope.gain.cancelScheduledValues(now);v.envelope.gain.setValueAtTime(v.envelope.gain.value,now);v.envelope.gain.linearRampToValueAtTime(0,now+.008);try{v.source.stop(now+.009);v.mod?.stop(now+.009);}catch{}
  }
  stopEffects(){this.cancelSpeech();for(const v of [...this.voices.values()])this.dispose(v);}
  stopMusic(fade=false){for(const v of [...this.musicVoices.values()])fade?this.steal(v):this.dispose(v);}
  allocate(source,envelope,nodes,start,seconds,bus,mod){
    const map=bus==='music'?this.musicVoices:this.voices,limit=bus==='music'?CONFIG.audio.musicVoices:CONFIG.audio.maxVoices;
    while(map.size>=limit)this.steal(map.values().next().value);
    const v={source,envelope,nodes,start,end:start+seconds,map,mod,dead:false};map.set(source,v);this.created++;source.onended=()=>this.dispose(v);return v;
  }
  admit(bus){const map=bus==='music'?this.musicVoices:this.voices,limit=bus==='music'?CONFIG.audio.musicVoices:CONFIG.audio.maxVoices;if(map.size>=limit&&this.tails.size>=CONFIG.audio.maxTails){this.dropped++;return false;}return true;}
  synth({from,to=from,seconds=.2,type='sine',start=this.context?.currentTime,level=.3,bus='sfx',attack=.005,fm=0,depth=1,cutoff=0}){
    if(!this.context||this.context.state==='closed'||this.paused||!Number.isFinite(from)||!Number.isFinite(to)||!this.admit(bus))return;
    try{const c=this.context,source=c.createOscillator(),envelope=c.createGain(),nodes=[source,envelope];start=Math.max(start,c.currentTime);seconds=Math.max(.025,seconds);source.type=type;source.frequency.setValueAtTime(Math.max(12,from),start);source.frequency.exponentialRampToValueAtTime(Math.max(12,to),start+seconds);
      let mod;if(fm){mod=c.createOscillator();const depthGain=c.createGain();mod.frequency.setValueAtTime(from*fm,start);depthGain.gain.setValueAtTime(from*depth,start);depthGain.gain.exponentialRampToValueAtTime(.01,start+seconds);mod.connect(depthGain);depthGain.connect(source.frequency);mod.start(start);mod.stop(start+seconds);nodes.push(mod,depthGain);}
      const peak=Math.max(.001,Math.min(.9,level)),a=Math.min(attack,seconds*.15);envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(peak,start+a);envelope.gain.exponentialRampToValueAtTime(peak*.45,start+seconds*.3);envelope.gain.exponentialRampToValueAtTime(.0001,start+seconds-.004);envelope.gain.linearRampToValueAtTime(0,start+seconds);
      source.connect(envelope);const target=bus==='music'?this.musicBus:this.master;if(cutoff){const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.6;envelope.connect(filter);filter.connect(target);nodes.push(filter);}else envelope.connect(target);
      this.allocate(source,envelope,nodes,start,seconds,bus,mod);source.start(start);source.stop(start+seconds);
    }catch{/* Audio may be revoked on device suspension. */}
  }
  tone(from,to,seconds,type='sine',delay=0,level=1){this.synth({from,to,seconds,type,start:(this.context?.currentTime??0)+delay,level});}
  fm(from,to,seconds=.22,delay=0,level=.3){this.synth({from,to,seconds,start:(this.context?.currentTime??0)+delay,level,fm:2.75,depth:1.3,cutoff:6500});}
  percussion(seconds,level=.3,start=this.context?.currentTime,bus='sfx',cutoff=1200){
    if(!this.context||this.paused||!this.noiseBuffer||!this.admit(bus))return;
    try{const c=this.context,source=c.createBufferSource(),envelope=c.createGain(),filter=c.createBiquadFilter();start=Math.max(start,c.currentTime);source.buffer=this.noiseBuffer;filter.type=cutoff>4000?'highpass':'lowpass';filter.frequency.value=cutoff;filter.Q.value=.6;
      envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(level,start+.003);envelope.gain.exponentialRampToValueAtTime(.0001,start+seconds-.002);envelope.gain.linearRampToValueAtTime(0,start+seconds);source.connect(filter);filter.connect(envelope);envelope.connect(bus==='music'?this.musicBus:this.master);
      this.allocate(source,envelope,[source,envelope,filter],start,seconds,bus);source.start(start);source.stop(start+seconds);
    }catch{}
  }
  noise(seconds,level=.3){this.percussion(seconds,level,this.context?.currentTime);}
  zzfx(presetName,level=.32){
    const preset=ZZFX_PRESETS[presetName];
    if(!preset||!this.context||this.context.state==='closed'||this.paused||!this.admit('sfx'))return;
    try{
      this.zzfxCache??=new Map();
      let pcm=this.zzfxCache.get(presetName);
      if(!pcm){pcm=ZZFX.buildSamples(...preset);this.zzfxCache.set(presetName,pcm);}
      const c=this.context,rate=c.sampleRate||44100,len=Math.max(1,Math.min(pcm.length,Math.ceil(rate*.35)));
      const buffer=c.createBuffer(1,len,rate),channel=buffer.getChannelData(0);
      for(let i=0;i<len;i++)channel[i]=pcm[i];
      const source=c.createBufferSource(),envelope=c.createGain(),start=c.currentTime,seconds=len/rate;
      source.buffer=buffer;
      envelope.gain.setValueAtTime(level,start);
      envelope.gain.exponentialRampToValueAtTime(.0001,start+seconds);
      source.connect(envelope);envelope.connect(this.master);
      this.allocate(source,envelope,[source,envelope],start,seconds,'sfx');
      source.start(start);source.stop(start+seconds);
    }catch{}
  }
  diagnostics(){let peak=0,sum=0,finite=true;if(this.analyser){this.analyser.getFloatTimeDomainData(this.samples);for(const v of this.samples){finite&&=Number.isFinite(v);peak=Math.max(peak,Math.abs(v));sum+=v*v;}}return{state:this.context?.state??'locked',voices:this.voices.size,musicVoices:this.musicVoices.size,tails:this.tails.size,nodes:[...this.voices.values(),...this.musicVoices.values(),...this.tails].reduce((n,v)=>n+v.nodes.length,0),created:this.created,ended:this.ended,stolen:this.stolen,dropped:this.dropped,peak,rms:Math.sqrt(sum/2048),finite,mode:this.sequencer.mode,calm:this.sequencer.calm,steps:this.sequencer.step,tracks:{...this.sequencer.counts}};}

  play(event) {
    if (!event||this.profile?.data.settings.sound===false) return;
    const a = CONFIG.audio;
    if (event.type === 'shot') {
      this.synth({from:event.powered?240:175,to:48,seconds:.07,level:.34,type:'triangle',fm:1.4,depth:.7,cutoff:2800});
      this.noise(.035,event.powered?.23:.17);
    }
    if (event.type === 'boss') { this.tone(120,60,.35,'sawtooth',0,.3);this.tone(523,262,.2,'triangle',.2,.22); }
    if (event.type === 'hit'&&(this.context?.currentTime??0)-this.lastImpact>=.035) {
      this.lastImpact=this.context?.currentTime??0;
      this.tone(530+(event.crack??0)*100,145,.065,'triangle',0,.35);this.noise(.04,.22);
    }
    if(event.type==='armor-break'){this.zzfx('armorBreak',.38);this.tone(860,280,.12,'square',0,.19);}
    if(event.type==='train'){for(const delay of[0,.32]){this.tone(330,330,.24,'triangle',delay,.22);this.tone(440,440,.24,'sine',delay,.2);}this.noise(.12,.08);}
    if(event.type==='shield-block'){this.fm(330,990,.23,0,.3);this.noise(.065,.18);}
    if(['power-up','supply-pickup'].includes(event.type)){
      [392,523,784,1046].forEach((hz,i)=>this.tone(hz*.5,hz,.18,'sawtooth',i*.055,.25));
      this.tone(80,190,.28,'sine',0,.5);
    }
    if(event.type==='round-clear'){
      [523,659,784,1046,1318].forEach((hz,i)=>this.tone(hz,hz,.35,'triangle',i*.13,.5));
      if(event.final)this.tone(262,523,.6,'sine',.4,.4);
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
    if (['select','wave'].includes(event.type)){this.tone(523,784,.12,'triangle',0,.4);this.tone(1046,1175,.09,'sine',.025,.17);this.noise(.018,.08);}
    if(event.type==='word'){this.zzfx('boosterUp',.34);this.fm(880,1320,.2,0,.4);this.tone(1320,1760,.18,'sine',.04,.25);this.speak(event.word,'friend');}
    if(event.type==='sentence'){this.play({type:'round-clear',final:true});this.speak(event.speech,'friend');}
    if(event.type==='mission')this.speak(event.speech,'teacher');
    if(event.type==='mission-win'){this.play({type:'round-clear',final:true});this.noise(.22,.25);}
    if(event.type==='pickup'){this.zzfx('coreLock',.3);this.fm(1046,1568,.22,0,.33);this.fm(2093,2349,.19,.035,.16);}
    if(event.type==='smash'){this.zzfx(event.stomp?'stompBounce':'armorBreak',.42);this.tone(150,45,.2,'sine',0,.5);}
    if(['word-miss','mission-miss'].includes(event.type)){this.tone(350,260,.15,'triangle',0,.3);this.tone(220,180,.16,'sine',.06,.2);}
    if (['gate-miss', 'bump', 'puzzle-miss', 'locked'].includes(event.type)) this.tone(320, 190, 0.13, 'triangle', 0, 0.4);
    if (['reward', 'gate-win', 'puzzle-win', 'brake-win'].includes(event.type)) {
      if (event.type === 'puzzle-win') this.cancelSpeech();
      this.fm(784,1568,.35,0,.35);this.noise(.065,.12);
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
      this.noise(.035,.12);
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
    this.cancelSpeech();if(this.profile?.data.settings.sound===false)return false;
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
