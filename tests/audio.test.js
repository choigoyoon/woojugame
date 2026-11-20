import test from 'node:test';
import assert from 'node:assert/strict';
import { Audio, noteFrequency } from '../js/audio.js';
import { CONFIG } from '../js/config.js';

test('suspended audio remains bounded even when the browser never delivers onended', () => {
  const connected = new Set();
  const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class Node {
    gain = parameter();
    frequency = parameter();
    connect() { connected.add(this); }
    disconnect() { connected.delete(this); }
    start() {}
    stop() {} // A suspended AudioContext may defer the onended callback indefinitely.
  }
  class Context {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    createGain() { return new Node(); }
    createOscillator() { return new Node(); }
    resume() { return Promise.resolve(); }
  }
  const originalWindow = globalThis.window;
  globalThis.window = { AudioContext: Context };
  try {
    const audio = new Audio();
    audio.unlock();
    for (let index = 0; index < 500; index += 1) audio.play({ type: 'jump', bonus: 5 });
    assert.equal(audio.voices.size, CONFIG.audio.maxVoices);
    assert.equal(connected.size, CONFIG.audio.maxVoices * 2 + 1); // Oscillator + envelope, plus master.
    audio.pause();
    assert.equal(audio.voices.size, 0);
    assert.equal(connected.size, 1); // Only the reusable master remains.
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('jump sounds follow the major scale without exceeding an octave; bonus adds an arpeggio', () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => noteFrequency(i)), [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25]);
  for (const index of [-10, NaN, Infinity, undefined]) assert.equal(noteFrequency(index), 261.63);
  assert.equal(noteFrequency(100), 523.25);
  const audio = new Audio();
  const tones = [];
  audio.tone = (...args) => tones.push(args);
  audio.play({ type: 'jump', noteIndex: 4, bonus: 5 });
  assert.equal(tones[0][1], 392);
  assert.equal(tones[1][0], 784);
  assert.equal(tones.length, 6);
  const chord = tones.slice(2);
  assert.ok(chord.every((tone, i) => !i || tone[0] > chord[i - 1][0]));
  assert.ok(chord.every((tone, i) => tone[4] === i * CONFIG.audio.comboSpacingSeconds));
});

test('missing Korean/local TTS uses a distinct synthesized cue for each situation without throwing', () => {
  const original=globalThis.speechSynthesis;
  globalThis.speechSynthesis={cancel(){},getVoices(){return[{lang:'ko-KR',localService:false}];}};
  try {
    const audio=new Audio(),patterns=[];let tones=[];
    audio.tone=(...args)=>tones.push(args);
    for(const cue of ['teacher','bell','rain','friend']){
      tones=[];assert.equal(audio.speak('상황',cue),false);assert.ok(tones.length>=2);patterns.push(JSON.stringify(tones));
    }
    assert.equal(new Set(patterns).size,4);
    globalThis.speechSynthesis.getVoices=()=>{throw Error('not available');};
    assert.doesNotThrow(()=>audio.speak('상황','rain'));
  } finally {
    if(original===undefined)delete globalThis.speechSynthesis;else globalThis.speechSynthesis=original;
  }
});
