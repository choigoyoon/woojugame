import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION, CONFIG, MODE } from '../js/config.js';
import { Game } from '../js/game.js';
import { actionAt, toGamePoint } from '../js/input.js';

const coreGame = (random = Math.random) => new Game(random, { events: false });

function climb(game) {
  if (game.state.facing !== game.nextDirection) game.act(ACTION.TURN);
  return game.act(ACTION.CLIMB);
}

test('core stair action starts ready; only released arcade features are enabled', () => {
  const game = coreGame(() => 0.5);
  assert.equal(game.state.mode, MODE.PLAYING);
  assert.equal(game.state.facing, game.nextDirection);
  assert.equal(game.state.step, 0);
  assert.equal(CONFIG.features.brake, true);
  assert.equal(CONFIG.features.puzzle, true);
  assert.equal(CONFIG.features.shop, true);
  assert.equal(CONFIG.features.pwa, true);
  assert.ok(Object.values(game.state.future).every((value) => value === null));
});

test('turn changes only facing; ten and twenty successful steps award exact coin bonuses', () => {
  const game = coreGame();
  const before = { ...game.state };
  game.act(ACTION.TURN);
  assert.equal(game.state.facing, -before.facing);
  assert.equal(game.state.step, before.step);
  assert.equal(game.state.coins, before.coins);
  for (let n = 1; n <= 20; n += 1) {
    const event = climb(game);
    assert.equal(game.state.coins, n + Math.floor(n / 10) * 5);
    assert.equal(event.bonus, n % 10 === 0 ? 5 : 0);
  }
});

test('wrong direction keeps coins and position, resets only combo, and recovers at 1000ms', () => {
  const game = coreGame();
  for (let n = 0; n < 12; n += 1) climb(game);
  if (game.state.facing === game.nextDirection) game.act(ACTION.TURN);
  const { coins, step } = game.state;
  const current = game.current;
  assert.equal(game.act(ACTION.CLIMB).type, 'stumble');
  assert.equal(game.current, current);
  assert.equal(game.state.step, step);
  assert.equal(game.state.coins, coins);
  assert.equal(game.state.combo, 0);
  assert.equal(game.act(ACTION.TURN), null);
  assert.equal(game.act(ACTION.CLIMB), null);
  game.advance(999);
  assert.equal(game.state.mode, MODE.STUMBLE);
  game.advance(1);
  assert.equal(game.state.mode, MODE.PLAYING);
  assert.equal(game.state.step, step); // Blocked presses must not be replayed.
  climb(game);
  assert.equal(game.state.coins, coins + 1);
  assert.equal(game.state.combo, 1);
});

test('background time and input do not alter the game or expire a stumble', () => {
  const game = coreGame();
  game.act(ACTION.TURN); game.act(ACTION.CLIMB); game.advance(300);
  game.setPaused(true);
  game.advance(100_000);
  assert.equal(game.act(ACTION.TURN), null);
  assert.equal(game.state.stumbleRemainingMs, 700);
  assert.equal(game.state.elapsedMs, 300);
  game.setPaused(false); game.advance(700);
  assert.equal(game.state.mode, MODE.PLAYING);
});

test('every same-frame action is processed in order without animation locking', () => {
  const game = coreGame();
  for (let n = 0; n < 200; n += 1) climb(game); // No advance/render between inputs.
  assert.equal(game.state.step, 200);
  assert.equal(game.state.coins, 300);
  assert.equal(game.metrics.received, game.metrics.accepted);
  assert.equal(game.metrics.blocked, 0);
  assert.equal(game.state.mode, MODE.PLAYING);
  assert.ok(Object.values(game.state.future).every((value) => value === null));
});

test('10,000 steps reuse a fixed pool and every platform remains reachable inside the screen', () => {
  let seed = 7;
  const game = coreGame(() => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32));
  for (let n = 0; n < 20; n += 1) climb(game);
  const pool = new Set(game.steps);
  for (let n = 0; n < 10_000; n += 1) {
    assert.equal(Math.abs(game.next.x - game.current.x), CONFIG.stairs.stepX);
    assert.equal(game.current.y - game.next.y, CONFIG.stairs.stepY);
    assert.ok(game.next.column >= CONFIG.stairs.minColumn && game.next.column <= CONFIG.stairs.maxColumn);
    climb(game);
    assert.equal(game.steps.length, CONFIG.stairs.ahead + CONFIG.stairs.behind + 1);
    assert.ok(game.steps.every((step) => pool.has(step)));
  }
  assert.equal(game.state.coins, 15_030);
});

test('invalid actions and invalid time cannot corrupt state', () => {
  const game = coreGame();
  const before = game.snapshot();
  game.act('shop'); game.advance(NaN); game.advance(-100); game.advance(Infinity);
  assert.deepEqual(game.snapshot(), before);
});

test('hit testing uses the full bottom 22 percent after scaling and centering', () => {
  for (const scale of [0.3, 0.5, 0.75, 1]) {
    const bounds = { left: 50, top: 48, width: 720 * scale, height: 1280 * scale };
    const point = (x, y) => toGamePoint(bounds.left + x * scale, bounds.top + y * scale, bounds);
    assert.equal(actionAt(point(1, 1000)), ACTION.TURN);
    assert.equal(actionAt(point(719, 1279)), ACTION.CLIMB);
    assert.equal(actionAt(point(360, 1100)), ACTION.CLIMB);
    assert.equal(actionAt(point(180, 990)), null);
    assert.equal(actionAt(point(-1, 1100)), null);
    assert.equal(actionAt(point(720, 1100)), null);
    assert.equal(actionAt(point(360, 1280)), null);
  }
});

test('fast climbs ascend the scale; turns preserve rhythm, pauses and slow climbs restart it', () => {
  const game = coreGame();
  for (let n = 0; n < 20; n += 1) {
    const event = climb(game);
    assert.equal(event.noteIndex, Math.min(n, 7));
    game.advance(125);
    const rhythm = game.state.rhythm;
    game.act(ACTION.TURN); game.act(ACTION.TURN);
    assert.equal(game.state.rhythm, rhythm);
  }
  game.advance(CONFIG.rhythm.chainWindowMs);
  assert.equal(climb(game).noteIndex, 0);
  game.setPaused(true); game.advance(20_000); game.setPaused(false);
  assert.equal(climb(game).noteIndex, 0);
});

test('star eyes start at ten; dizziness overrides them and recovery resets the melody', () => {
  const game = coreGame();
  for (let n = 0; n < 9; n += 1) climb(game);
  assert.equal(game.expression, 'smile');
  climb(game);
  assert.equal(game.expression, 'star');
  if (game.state.facing === game.nextDirection) game.act(ACTION.TURN);
  game.act(ACTION.CLIMB);
  assert.equal(game.expression, 'dizzy');
  game.advance(CONFIG.rules.stumbleMs);
  assert.equal(game.expression, 'smile');
  assert.equal(climb(game).noteIndex, 0);
});
