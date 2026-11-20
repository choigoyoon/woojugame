import { ACTION, CONFIG, MODE } from './config.js';

const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - (1 - t) ** 3;
const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game;
    this.ratio = 1;
    this.cameraY = 0;
    this.pose = { x: game.current.x, y: game.current.y, lift: 0 };
    this.jump = null;
    this.shake = 0;
    this.time = 0;
    this.press = { turn: 0, climb: 0 };
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.particles = Array.from({ length: CONFIG.motion.particleCount }, () => ({ life: 0 }));
    this.popups = Array.from({ length: CONFIG.motion.popupCount }, () => ({ life: 0 }));
    this.particleCursor = 0;
    this.popupCursor = 0;
    this.clouds = [
      { x: 70, y: 310, scale: 1.1 }, { x: 585, y: 190, scale: 0.8 },
      { x: 540, y: 550, scale: 1.2 }, { x: 100, y: 710, scale: 0.7 },
    ];
  }

  resize(width, height, dpr = window.devicePixelRatio || 1) {
    const pixelRatio = Math.min(dpr, CONFIG.view.maxDpr);
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.ratio = this.canvas.width / CONFIG.view.width;
  }

  handle(event, action) {
    this.press[action] = CONFIG.motion.pressMs;
    if (!event) return;
    if (event.type === 'jump') {
      this.jump = { fromX: this.pose.x, fromY: this.pose.y - this.pose.lift, x: event.x, y: event.y, elapsed: 0 };
      this.shake = CONFIG.motion.shakeMs;
      this.burst(event.from.x, event.from.y, CONFIG.motion.particlesPerJump, false);
      if (event.bonus) this.burst(event.x, event.y - 80, CONFIG.motion.particlesPerCombo, true);
      const popup = this.popups[this.popupCursor++ % this.popups.length];
      Object.assign(popup, { x: event.x, y: event.y - 140, life: CONFIG.motion.popupLifeMs, bonus: event.bonus });
    }
    if (event.type === 'stumble') this.shake = CONFIG.motion.shakeMs;
  }

  burst(x, y, count, gold) {
    for (let index = 0; index < count; index += 1) {
      const particle = this.particles[this.particleCursor++ % this.particles.length];
      const angle = Math.random() * TAU;
      Object.assign(particle, {
        x, y, vx: Math.cos(angle) * CONFIG.motion.particleSpeed,
        vy: -Math.random() * CONFIG.motion.particleSpeed * 2,
        size: 5 + Math.random() * 8, life: CONFIG.motion.particleLifeMs,
        color: gold ? ['#ffcf48', '#fff3ab', '#ff9e3d'][index % 3] : ['#79f6ed', '#fff', '#9b86fa'][index % 3],
      });
    }
  }

  update(delta) {
    const dt = Math.min(delta, CONFIG.motion.maxFrameMs);
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    for (const action of Object.keys(this.press)) this.press[action] = Math.max(0, this.press[action] - dt);
    if (this.jump) {
      this.jump.elapsed = Math.min(CONFIG.motion.hopMs, this.jump.elapsed + dt);
      const t = this.jump.elapsed / CONFIG.motion.hopMs;
      this.pose.x = mix(this.jump.fromX, this.jump.x, ease(t));
      this.pose.y = mix(this.jump.fromY, this.jump.y, ease(t));
      this.pose.lift = Math.sin(t * Math.PI) * (this.reducedMotion ? 0 : CONFIG.motion.hopHeight);
      if (t === 1) this.jump = null;
    }
    this.cameraY = mix(this.cameraY, this.game.current.y, 1 - Math.exp(-dt / CONFIG.motion.cameraMs));
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      particle.life -= dt;
      particle.x += particle.vx * dt / 1000;
      particle.y += particle.vy * dt / 1000;
      particle.vy += CONFIG.motion.particleGravity * dt / 1000;
    }
    for (const popup of this.popups) if (popup.life > 0) { popup.life -= dt; popup.y -= dt * 0.05; }
  }

  polygon(points, fill, stroke = null, width = 2) {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
    c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }

  rect(x, y, width, height, fill, radius = 0, stroke = null) {
    const c = this.ctx;
    c.beginPath(); c.roundRect(x, y, width, height, radius);
    c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }

  text(value, x, y, size, fill = '#fff', align = 'left', weight = 800) {
    const c = this.ctx;
    c.font = `${weight} ${size}px system-ui, sans-serif`;
    c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = fill;
    c.fillText(String(value), x, y);
  }

  star(x, y, radius, fill) {
    this.polygon(Array.from({ length: 10 }, (_, i) => {
      const angle = i * Math.PI / 5 - Math.PI / 2;
      const r = i % 2 ? radius * 0.45 : radius;
      return [x + Math.cos(angle) * r, y + Math.sin(angle) * r];
    }), fill);
  }

  coin(x, y, scale = 1) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(scale, scale);
    this.polygon([[-19, -11], [0, -22], [19, -11], [19, 12], [0, 24], [-19, 12]], '#e79632', '#62424a', 3);
    this.polygon([[-16, -13], [0, -23], [16, -13], [16, 8], [0, 18], [-16, 8]], '#ffda59');
    this.rect(-4, -12, 8, 21, '#fff3ad', 2);
    c.restore();
  }

  arrow(x, y, direction, scale, color = '#fff') {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(scale * direction, scale);
    this.polygon([[-24, -7], [4, -7], [4, -23], [30, 0], [4, 23], [4, 7], [-24, 7]], color);
    c.restore();
  }

  screenY(y) { return CONFIG.motion.anchorY + y - this.cameraY; }

  background() {
    const c = this.ctx;
    const gradient = c.createLinearGradient(0, 0, 0, CONFIG.view.height);
    gradient.addColorStop(0, '#326bc1'); gradient.addColorStop(0.44, '#59c4e7');
    gradient.addColorStop(1, '#b0eee5');
    c.fillStyle = gradient; c.fillRect(0, 0, CONFIG.view.width, CONFIG.view.height);
    // A block sun and drifting clouds give depth without downloaded images.
    c.save(); c.translate(586, 297); c.rotate(Math.PI / 4);
    this.rect(-53, -53, 106, 106, '#fff6bb33', 14);
    this.rect(-37, -37, 74, 74, '#fff3ac', 9);
    c.restore();
    for (const cloud of this.clouds) {
      c.save();
      c.translate(cloud.x + Math.sin(this.time / 6000 + cloud.y) * 15, cloud.y);
      c.scale(cloud.scale, cloud.scale); c.globalAlpha = 0.36;
      this.rect(-62, 0, 124, 22, '#e5ffff', 3);
      this.rect(-40, -24, 46, 30, '#fff', 3);
      this.rect(2, -12, 40, 22, '#fff', 3);
      c.restore();
    }
    c.save(); c.globalAlpha = 0.16;
    for (let index = 0; index < 5; index += 1) {
      const x = index * 193 - 30;
      const y = 880 + Math.sin(index * 13) * 110;
      this.polygon([[x - 100, y], [x, y - 40], [x + 100, y], [x, y + 90]], '#365aae');
      this.polygon([[x - 100, y], [x, y - 40], [x + 100, y], [x, y + 32]], '#e2feff');
    }
    c.restore();
    for (let index = 0; index < 16; index += 1) {
      const x = (index * 137 + 43) % CONFIG.view.width;
      const y = 220 + (index * 109) % 730;
      c.globalAlpha = 0.25 + Math.sin(this.time / 800 + index) * 0.15;
      this.rect(x, y, 4, 4, '#fff');
    }
    c.globalAlpha = 1;
  }

  platform(step) {
    const { state } = this.game;
    const x = step.x; const y = this.screenY(step.y);
    if (y < CONFIG.motion.clipTop - 100 || y > CONFIG.view.height) return;
    const next = step.id === state.step + 1;
    const current = step.id === state.step;
    const palette = step.id % 4 === 0
      ? ['#bdabff', '#8d6cdb', '#6350b1']
      : ['#a3f9ed', '#42b6b1', '#288e9e'];
    if (next) {
      this.polygon([[x - 94, y], [x, y - 37], [x + 94, y], [x, y + 37]], '#fff7aa55');
    }
    this.polygon([[x - 82, y], [x, y + 29], [x, y + 65], [x - 82, y + 34]], current ? '#e8a442' : palette[1], '#234c6c', 3);
    this.polygon([[x, y + 29], [x + 82, y], [x + 82, y + 34], [x, y + 65]], current ? '#bb7837' : palette[2], '#234c6c', 3);
    this.polygon([[x - 82, y], [x, y - 29], [x + 82, y], [x, y + 29]], current ? '#ffe183' : palette[0], next ? '#fff8ce' : '#234c6c', next ? 5 : 3);
    this.polygon([[x - 62, y - 1], [x, y - 21], [x + 62, y - 1], [x, y + 20]], next ? '#e9fff7' : '#ffffff22');
    this.rect(x + 25, y + 28, 22, 5, '#ffffff2a', 1);
    if (step.id > state.step && step.id <= state.step + 6) {
      this.coin(x, y - 53 + Math.sin(this.time / 260 + step.id) * 4, next ? 0.9 : 0.65);
    }
  }

  avatar() {
    const c = this.ctx;
    const { state } = this.game;
    const { x, y, lift } = this.pose;
    const sy = this.screenY(y);
    c.fillStyle = '#234b6e3b'; c.beginPath(); c.ellipse(x, sy, 43, 15, 0, 0, TAU); c.fill();
    c.save(); c.translate(x, sy - lift);
    const stumble = state.mode === MODE.STUMBLE;
    if (stumble && !this.reducedMotion) c.rotate(Math.sin(this.time / 65) * 0.13);
    // Chunky limbs, shaded torso and square helmet, all drawn locally.
    this.rect(-30, -39, 25, 36, '#253a6b', 3, '#22324e');
    this.rect(6, -39, 25, 36, '#38578a', 3, '#22324e');
    this.rect(-34, -10, 30, 13, '#ebfaff', 3);
    this.rect(6, -10, 31, 13, '#ebfaff', 3);
    this.rect(-49, -82, 20, 41, '#ffc273', 3, '#754a51');
    this.rect(30, -82, 20, 41, '#ffe09b', 3, '#754a51');
    this.rect(-35, -92, 70, 57, '#ff755d', 5, '#833e52');
    this.rect(-33, -89, 13, 49, '#df5260', 2);
    this.rect(-13, -86, 28, 31, '#fff3d5', 4);
    this.star(1, -71, 9, '#ee9b38');
    this.rect(-32, -144, 65, 57, '#ffda91', 6, '#4a4862');
    this.rect(-32, -143, 11, 53, '#eab270', 4);
    this.polygon([[-39, -144], [-25, -161], [32, -161], [42, -146], [42, -128], [-39, -128]], '#3cd7df', '#234c6c', 3);
    this.rect(-25, -154, 50, 10, '#b2ffff', 3);
    this.rect(-39, -130, 12, 27, '#2daebf', 3);
    this.rect(29, -130, 12, 27, '#2daebf', 3);
    const look = state.facing * 6;
    if (stumble) {
      for (const eye of [-13, 13]) {
        c.strokeStyle = '#3b3c59'; c.lineWidth = 4; c.beginPath();
        c.moveTo(eye - 4, -117); c.lineTo(eye + 4, -109);
        c.moveTo(eye + 4, -117); c.lineTo(eye - 4, -109); c.stroke();
      }
    } else {
      this.rect(-16 + look, -119, 7, 12, '#303d58', 2);
      this.rect(8 + look, -119, 7, 12, '#303d58', 2);
      this.rect(-3 + look, -102, 12, 4, '#aa655d', 2);
    }
    if (stumble) {
      for (let index = 0; index < 3; index += 1) {
        const angle = this.time / 150 + index * TAU / 3;
        this.star(Math.cos(angle) * 47, -180 + Math.sin(angle) * 10, 10, '#ffec79');
      }
    } else {
      this.arrow(state.facing * 68, -85, state.facing, 0.55, '#fff7ad');
    }
    c.restore();
  }

  hud() {
    const c = this.ctx; const { state } = this.game;
    const shade = c.createLinearGradient(0, 0, 0, 210);
    shade.addColorStop(0, '#1f4b9af2'); shade.addColorStop(1, '#2f80c500');
    c.fillStyle = shade; c.fillRect(0, 0, 720, 220);
    this.polygon([[38, 35], [51, 27], [64, 35], [64, 51], [51, 59], [38, 51]], '#7cf7e5');
    this.text('우주 블록 런', 77, 44, 28, '#e3faff');
    this.rect(28, 86, 312, 104, '#173a748c', 22, '#a9e3ff36');
    this.rect(356, 86, 336, 104, '#173a748c', 22, '#a9e3ff36');
    this.rect(54, 145, 12, 16, '#9aefef', 2);
    this.rect(70, 130, 12, 31, '#9aefef', 2);
    this.rect(86, 114, 12, 47, '#c8ffff', 2);
    this.text(state.step, 126, 140, state.step > 99999 ? 34 : 48, '#fff');
    this.coin(397, 139, 1.1);
    this.text(state.coins, 436, 140, state.coins > 99999 ? 34 : 48, '#fff4b2');
    if (state.combo > 1) {
      const scale = state.combo % CONFIG.rules.comboEvery === 0 ? 1.1 : 1;
      c.save(); c.translate(360, 232); c.scale(scale, scale);
      this.rect(-66, -22, 132, 44, '#213e7355', 20);
      this.polygon([[-40, -15], [-53, 3], [-40, 3], [-45, 16], [-22, -5], [-36, -5]], '#ffe57a');
      this.text(`×${state.combo}`, 10, 0, 28, '#fff5ba', 'center');
      c.restore();
    }
  }

  controls(input) {
    const c = this.ctx;
    const top = CONFIG.view.height * (1 - CONFIG.view.controlFraction);
    const fade = c.createLinearGradient(0, top - 50, 0, top + 30);
    fade.addColorStop(0, '#17355d00'); fade.addColorStop(1, '#17355d');
    c.fillStyle = fade; c.fillRect(0, top - 50, 720, 80);
    this.rect(0, top + 30, 720, CONFIG.view.height - top, '#17355d');
    const blocked = this.game.state.mode !== MODE.PLAYING;
    for (const [index, action] of [ACTION.TURN, ACTION.CLIMB].entries()) {
      const x = 24 + index * 360;
      const pressed = input?.isPressed(action) || this.press[action] > 0;
      const y = top + 22 + (pressed ? 10 : 0);
      const front = action === ACTION.TURN ? '#9373ed' : '#ffbf52';
      const dark = action === ACTION.TURN ? '#594695' : '#b3752f';
      this.rect(x, top + 40, 312, 213, '#0c2447', 30);
      this.rect(x, top + 31, 312, 204, dark, 27);
      this.rect(x, y, 312, 194, blocked ? '#7891ad' : front, 27, '#ffffff4a');
      this.rect(x + 16, y + 13, 280, 8, '#ffffff36', 4);
      c.save(); c.translate(x + 156, y + 94);
      if (action === ACTION.TURN) {
        this.arrow(0, -19, -1, 1.2, '#fff7ff');
        this.arrow(0, 20, 1, 1.2, '#fff7ff');
      } else {
        this.rect(-51, 38, 35, 14, '#734c3c', 3);
        this.rect(-7, 16, 35, 36, '#734c3c', 3);
        this.rect(37, -8, 35, 60, '#734c3c', 3);
        c.save(); c.translate(-9, -28); c.rotate(-Math.PI / 2);
        this.arrow(0, 0, 1, 1.25, '#fffdf0'); c.restore();
      }
      c.restore();
    }
    this.rect(302, 1254, 116, 5, '#52718f', 3);
  }

  render(input) {
    const c = this.ctx;
    c.setTransform(this.ratio, 0, 0, this.canvas.height / CONFIG.view.height, 0, 0);
    this.background();
    c.save();
    c.beginPath(); c.rect(0, CONFIG.motion.clipTop, 720, CONFIG.view.height * (1 - CONFIG.view.controlFraction) - CONFIG.motion.clipTop); c.clip();
    if (this.shake > 0 && !this.reducedMotion) {
      const amplitude = this.game.state.mode === MODE.STUMBLE ? CONFIG.motion.stumbleShakePx : CONFIG.motion.shakePx;
      const strength = this.shake / CONFIG.motion.shakeMs;
      c.translate(Math.sin(this.time * 0.11) * amplitude * strength, Math.cos(this.time * 0.08) * amplitude * strength);
    }
    for (let index = this.game.steps.length - 1; index >= 0; index -= 1) this.platform(this.game.steps[index]);
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      c.globalAlpha = Math.max(0, particle.life / CONFIG.motion.particleLifeMs);
      this.rect(particle.x, this.screenY(particle.y), particle.size, particle.size, particle.color, 1);
    }
    c.globalAlpha = 1;
    this.avatar();
    for (const popup of this.popups) {
      if (popup.life <= 0) continue;
      c.globalAlpha = Math.min(1, popup.life / 200);
      this.text(popup.bonus ? `+${CONFIG.rules.stepCoins + popup.bonus}` : `+${CONFIG.rules.stepCoins}`, popup.x + 46, this.screenY(popup.y), popup.bonus ? 43 : 30, '#fff5b6', 'center');
    }
    c.globalAlpha = 1; c.restore();
    this.hud(); this.controls(input);
    if (this.game.state.paused) {
      this.rect(0, 0, 720, 1280, '#112e5370');
      this.rect(302, 569, 116, 116, '#183861cc', 25);
      this.rect(332, 600, 17, 54, '#f5fbff', 3);
      this.rect(371, 600, 17, 54, '#f5fbff', 3);
    }
  }
}
