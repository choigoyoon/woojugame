import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION, CONFIG } from '../js/config.js';
import { Game } from '../js/game.js';
import { Renderer, advanceSpring, skyForStep } from '../js/renderer.js';

test('spring rebound is frame-rate independent and settles after a long frame', () => {
  const simulate = (fps) => {
    const body = { value: 0, velocity: CONFIG.motion.platformImpulse };
    for (let i = 0; i < fps / 10; i += 1) advanceSpring(body, 0, 1000 / fps, 26, 0.52);
    return body;
  };
  const baseline = simulate(30);
  assert.ok(baseline.value > 0); // Platform moves down first.
  for (const fps of [60, 120]) {
    const body = simulate(fps);
    assert.ok(Math.abs(body.value - baseline.value) < 1e-10);
    assert.ok(Math.abs(body.velocity - baseline.velocity) < 1e-10);
  }
  advanceSpring(baseline, 0, 10_000, 26, 0.52);
  assert.ok(Math.abs(baseline.value) < 1e-8 && Math.abs(baseline.velocity) < 1e-8);
});

test('height transitions are continuous and remain in the space palette beyond its threshold', () => {
  assert.deepEqual(skyForStep(-1).colors, CONFIG.sky.colors[0]);
  assert.deepEqual(skyForStep(80).colors, CONFIG.sky.colors[1]);
  assert.deepEqual(skyForStep(200).colors, CONFIG.sky.colors[2]);
  assert.deepEqual(skyForStep(10000).colors, CONFIG.sky.colors[2]);
  assert.deepEqual(skyForStep(79.999).colors, skyForStep(80.001).colors);
  const night = [0, 40, 80, 120, 160, 200].map((step) => skyForStep(step).night);
  assert.ok(night.every((n, i) => n >= 0 && n <= 1 && (!i || n >= night[i - 1])));
});

test('repeated inputs retarget one hop; landing occurs once, compresses body/tile and pools stay bounded', () => {
  const original = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  try {
    const game = new Game(Math.random, { events: false });
    const renderer = new Renderer({ getContext: () => ({}) }, game);
    const climb = () => {
      if (game.state.facing !== game.nextDirection) renderer.handle(game.act(ACTION.TURN), ACTION.TURN);
      renderer.handle(game.act(ACTION.CLIMB), ACTION.CLIMB, { x: 600, y: 1150 });
    };
    climb(); renderer.update(40);
    const visible = { ...renderer.pose };
    climb();
    assert.equal(renderer.jump.fromX, visible.x);
    assert.equal(renderer.jump.fromY, visible.y);
    assert.equal(renderer.jump.fromLift, visible.lift);
    for (let i = 0; i < 198; i += 1) climb();
    assert.equal(game.state.step, 200);
    assert.ok(renderer.aura > 0);
    assert.equal(renderer.update(190).step, 200);
    assert.equal(renderer.update(30), null); // No canceled-hop landing sounds or duplicate landings.
    const state = renderer.snapshot();
    assert.equal(state.airborne, false);
    assert.ok(state.bodyCompression > 0 && state.platformCompression > 0);
    assert.equal(state.tileSprings, 1);
    assert.ok(state.ripples.length <= CONFIG.motion.rippleCount);
    assert.ok(state.ripples.some((ripple) => ripple.x === 600 && ripple.y === 1150));
    assert.ok(renderer.particles.filter((p) => p.life > 0).length <= CONFIG.motion.particleCount);
    assert.equal(game.state.coins, 300);
    renderer.update(10_000);
    assert.equal(renderer.snapshot().tileSprings, 0);
    assert.equal(renderer.snapshot().auraMs, 0);
    assert.equal(renderer.snapshot().ripples.length, 0);
    assert.equal(renderer.update(1), null);
  } finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
});
