import { CONFIG } from './config.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { Audio } from './audio.js';

const canvas = document.querySelector('#scene');
const element = document.querySelector('#game');
const viewport = document.querySelector('#viewport');
const score = document.querySelector('#score');
const game = new Game();
const renderer = new Renderer(canvas, game);
const audio = new Audio();
let lastTime = performance.now();
let frames = 0;
let frameId = null;
let pageAway = false;

document.documentElement.style.setProperty('--safe-min', `${CONFIG.view.safeMinPx}px`);
document.documentElement.style.setProperty('--controls-height', `${CONFIG.view.controlFraction * 100}%`);

function advance(now) {
  const delta = Math.max(0, now - lastTime);
  lastTime = now;
  if (game.state.paused) return;
  game.advance(delta);
  renderer.update(delta);
}

const input = new Input(element, {
  turn: document.querySelector('#turn'), climb: document.querySelector('#climb'),
}, (action) => {
  advance(performance.now());
  const event = game.act(action);
  renderer.handle(event, action);
  audio.play(event);
  score.value = `계단 ${game.state.step}, 코인 ${game.state.coins}, 콤보 ${game.state.combo}`;
}, () => { if (!game.state.paused) audio.unlock(); });

function resize() {
  const style = getComputedStyle(viewport);
  const width = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const scale = Math.max(0, Math.min(width / CONFIG.view.width, height / CONFIG.view.height));
  const gameWidth = CONFIG.view.width * scale;
  const gameHeight = CONFIG.view.height * scale;
  element.style.width = `${gameWidth}px`;
  element.style.height = `${gameHeight}px`;
  renderer.resize(gameWidth, gameHeight);
  input.reset();
  renderer.render(input);
}

function frame(now) {
  frameId = null;
  advance(now);
  renderer.render(input);
  frames += 1;
  if (!game.state.paused) frameId = requestAnimationFrame(frame);
}

function syncVisibility() {
  const paused = document.hidden || pageAway || !document.hasFocus();
  if (paused === game.state.paused) return;
  advance(performance.now());
  game.setPaused(paused);
  input.reset();
  if (paused) {
    audio.pause();
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    renderer.render(input);
  } else {
    lastTime = performance.now();
    audio.resume();
    if (frameId === null) frameId = requestAnimationFrame(frame);
  }
}

new ResizeObserver(resize).observe(viewport);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', syncVisibility);
window.addEventListener('blur', syncVisibility);
window.addEventListener('focus', syncVisibility);
window.addEventListener('pagehide', () => { pageAway = true; syncVisibility(); });
window.addEventListener('pageshow', () => { pageAway = false; syncVisibility(); });

resize();
renderer.render(input);
const readyMs = performance.now();
frameId = requestAnimationFrame(frame);
syncVisibility();

// Explicit, read-only diagnostics for repeatable browser checks, never shown in the game UI.
if (new URLSearchParams(location.search).has('debug')) {
  Object.defineProperty(window, '__uju', {
    value: Object.freeze({ snapshot: () => ({
      ...game.snapshot(), frames, readyMs, activeTouches: input.active.size,
      particles: renderer.particles.filter((particle) => particle.life > 0).length,
      audioState: audio.context?.state ?? 'locked', voices: audio.voices.size,
      features: { ...CONFIG.features },
    }) }),
  });
}
