import test from 'node:test';
import assert from 'node:assert/strict';
import { Audio } from '../js/audio.js';
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
