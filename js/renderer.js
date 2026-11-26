import { ACTION, CONFIG, MODE } from './config.js';
import { Art } from './art.js';
import { AVATAR_PALETTE } from './profile.js';
import { webglStage } from './webgl-stage.js';

const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const TAU = Math.PI * 2;
const spring = () => ({ value: 0, velocity: 0 });

// Exact damped-spring integration: identical response at 30, 60 and 120 Hz.
export function advanceSpring(body, target, ms, frequency, damping) {
  const t = Math.max(0, ms) / 1000;
  const offset = body.value - target;
  const decay = Math.exp(-damping * frequency * t);
  const w = frequency * Math.sqrt(1 - damping * damping);
  const cos = Math.cos(w * t); const sin = Math.sin(w * t);
  const velocity = body.velocity;
  body.value = target + decay * (offset * cos + (velocity + damping * frequency * offset) / w * sin);
  body.velocity = decay * (velocity * cos - (damping * frequency * velocity + frequency * frequency * offset) / w * sin);
}

export function skyForStep(step) {
  const height = Math.max(0, step);
  const { stratosphereStep, spaceStep, colors } = CONFIG.sky;
  const band = height < stratosphereStep ? 0 : 1;
  const t = smooth(clamp(band === 0 ? height / stratosphereStep : (height - stratosphereStep) / (spaceStep - stratosphereStep), 0, 1));
  return {
    night: smooth(clamp((height - stratosphereStep * 0.55) / (spaceStep - stratosphereStep * 0.55), 0, 1)),
    colors: colors[band].map((hex, index) => {
      const a = parseInt(hex.slice(1), 16); const b = parseInt(colors[band + 1][index].slice(1), 16);
      return '#' + [16, 8, 0].map((shift) => Math.round(mix((a >> shift) & 255, (b >> shift) & 255, t)).toString(16).padStart(2, '0')).join('');
    }),
  };
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.art = new Art(this.ctx);
    this.game = game;
    this.ratio = 1;
    this.layers = new Map();
    this.cameraY = 0;
    this.pose = { x: game.current.x, y: game.current.y, lift: 0 };
    this.jump = null;this.hop={};
    this.shake = 0;
    this.time = 0;
    this.aura = 0;
    this.blink = 0;
    this.nextBlink = CONFIG.motion.blinkMinMs;
    this.body = spring();
    this.tiles = new Map();this.tilePool=Array.from({length:CONFIG.stairs.ahead+CONFIG.stairs.behind+8},()=>({value:0,velocity:0,id:-1}));
    this.press = { turn: 0, climb: 0 };
    this.buttons = { turn: spring(), climb: spring() };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = preference.matches;
    preference.addEventListener?.('change', (event) => { this.reducedMotion = event.matches; });
    this.particles = Array.from({ length: CONFIG.motion.particleCount }, () => ({ life: 0 }));
    this.popups = Array.from({ length: CONFIG.motion.popupCount }, () => ({ life: 0 }));
    this.ripples = Array.from({ length: CONFIG.motion.rippleCount }, () => ({ life: 0 }));
    this.particleCursor = 0; this.popupCursor = 0; this.rippleCursor = 0;
    this.clouds = Array.from({ length: 9 }, (_, i) => ({
      x: (i * 263 + 25) % 1040 - 160, y: (i * 197 + 240) % 1050,
      scale: 0.65 + i % 3 * 0.36, depth: 0.06 + i % 3 * 0.08, speed: 6 + i % 3 * 4,
    }));
    this.stars = Array.from({ length: CONFIG.sky.starCount }, (_, i) => ({
      x: (i * 173 + 27) % 720, y: (i * 113 + 81) % 1080, size: 1.5 + i % 4,
    }));
  }

  resize(width, height, dpr = window.devicePixelRatio || 1) {
    const pixelRatio = Math.min(dpr, CONFIG.view.maxDpr);
    const w=Math.max(1,Math.round(width*pixelRatio)),h=Math.max(1,Math.round(height*pixelRatio));
    if(this.canvas.width===w&&this.canvas.height===h)return false;
    this.canvas.width=w;this.canvas.height=h;
    this.ratio = this.canvas.width / CONFIG.view.width;
    return true;
  }

  handle(event, action, point) {
    if (action in this.press) {
      this.press[action] = CONFIG.motion.pressMs;
      const ripple = this.ripples[this.rippleCursor++ % this.ripples.length];
      Object.assign(ripple, {
        x: point?.x ?? (action === ACTION.TURN ? 180 : 540),
        y: point?.y ?? 1120, action, life: CONFIG.motion.rippleMs,
      });
    }
    if (!event) return;
    if (event.type === 'jump') {
      // Retarget from the visible pose, without delaying or queuing domain inputs.
      if (Math.abs(this.pose.y - event.y) > CONFIG.stairs.stepY * CONFIG.motion.maxVisualGap) {
        Object.assign(this.pose,{ x:event.from.x,y:event.from.y,lift:0 });
        this.cameraY = event.from.y;
      }
      this.jump = Object.assign(this.hop,{
        fromX: this.pose.x, fromY: this.pose.y, fromLift: Math.min(this.pose.lift, CONFIG.motion.hopHeight),
        x: event.x, y: event.y, step: event.step, direction: event.direction, elapsed: 0,
        duration: event.intervalMs > 0 ? clamp(event.intervalMs * CONFIG.motion.hopCadenceRatio, CONFIG.motion.minHopMs, CONFIG.motion.hopMs) : CONFIG.motion.hopMs,
      });
      this.body.value *= 0.3; this.body.velocity = 0;
      this.burst(this.pose.x, this.pose.y, CONFIG.motion.particlesPerJump, false);
      if (event.bonus) {
        this.aura = CONFIG.motion.auraMs;
        this.burst(this.pose.x, this.pose.y - 130, CONFIG.motion.particlesPerCombo, true);
      }
      if (!event.auto) {
        const popup = this.popups[this.popupCursor++ % this.popups.length];
        Object.assign(popup, { x: event.x, y: event.y - 240, life: CONFIG.motion.popupLifeMs, bonus: event.bonus });
      }
    }
    if (event.type === 'brake-win') { this.aura = CONFIG.motion.auraMs; this.burst(this.pose.x, this.pose.y - 130, CONFIG.motion.particlesPerCombo, true); }
    if (event.type === 'stumble') { this.shake = CONFIG.motion.shakeMs; this.aura = 0; }
  }

  burst(x, y, count, gold) {
    if (this.reducedMotion) count = Math.min(count, 4);
    for (let index = 0; index < count; index += 1) {
      const particle = this.particles[this.particleCursor++ % this.particles.length];
      const angle = Math.random() * TAU;
      const speed = CONFIG.motion.particleSpeed * (gold ? 1.8 : 0.5);
      Object.assign(particle, {
        x, y, vx: Math.cos(angle) * speed, vy: -Math.random() * speed * 1.8,
        rotation: angle, spin: (Math.random() - 0.5) * 14,
        size: (gold ? 8 : 4) + Math.random() * 7, life: CONFIG.motion.particleLifeMs,
        color: gold ? ['#ffdc55', '#fff6b5', '#ff8d8c', '#78fff1', '#bb98ff'][index % 5] : ['#a9fff6', '#fff', '#bfb2ff'][index % 3],
      });
    }
  }

  update(delta, input) {
    const dt = Math.max(0, delta);
    const m = CONFIG.motion;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.aura = Math.max(0, this.aura - dt);
    this.blink = Math.max(0, this.blink - dt);
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = m.blinkMs;
      this.nextBlink = m.blinkMinMs + Math.random() * (m.blinkMaxMs - m.blinkMinMs);
    }
    for (const action of Object.keys(this.press)) {
      this.press[action] = Math.max(0, this.press[action] - dt);
      const pressed = input?.isPressed(action) || this.press[action] > 0;
      advanceSpring(this.buttons[action], pressed ? m.buttonDepth : 0, dt, m.buttonFrequency, m.buttonDamping);
    }
    advanceSpring(this.body, 0, dt, m.landingFrequency, m.landingDamping);
    for (const [id, body] of this.tiles) {
      if (!this.game.steps.some((step) => step.id === id)) { body.id=-1;this.tiles.delete(id); continue; }
      advanceSpring(body, 0, dt, m.platformFrequency, m.platformDamping);
      if (Math.abs(body.value) + Math.abs(body.velocity) < 0.01){body.id=-1;this.tiles.delete(id);}
    }
    let landing = null;
    if (this.jump) {
      const jump = this.jump;
      jump.elapsed = Math.min(jump.duration, jump.elapsed + dt);
      const t = jump.elapsed / jump.duration;
      this.pose.x = mix(jump.fromX, jump.x, smooth(t));
      this.pose.y = mix(jump.fromY, jump.y, smooth(t));
      this.pose.lift = this.reducedMotion ? 0 : mix(jump.fromLift, 0, t) + Math.sin(t * Math.PI) * m.hopHeight;
      if (t === 1) {
        this.jump = null;
        this.body.velocity = m.landingImpulse;
        const tile=this.tiles.get(jump.step)??this.tilePool.find(tile=>tile.id===-1);
        if(tile){Object.assign(tile,{id:jump.step,value:0,velocity:m.platformImpulse});this.tiles.set(jump.step,tile);}
        this.burst(jump.x, jump.y, m.particlesPerLanding, false);
        this.shake = m.shakeMs * 0.45;
        landing = { type: 'land', step: jump.step };
      }
    }
    this.cameraY = mix(this.cameraY, this.game.current.y, 1 - Math.exp(-dt / m.cameraMs));
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      particle.life = Math.max(0, particle.life - dt);
      particle.x += particle.vx * dt / 1000;
      particle.y += particle.vy * dt / 1000 + 0.5 * m.particleGravity * (dt / 1000) ** 2;
      particle.vy += m.particleGravity * dt / 1000;
      particle.rotation += particle.spin * dt / 1000;
    }
    for (const popup of this.popups) if (popup.life > 0) { popup.life = Math.max(0, popup.life - dt); popup.y -= dt * 0.05; }
    for (const ripple of this.ripples) ripple.life = Math.max(0, ripple.life - dt);
    return landing;
  }

  snapshot() {
    return {
      pose: { ...this.pose }, expression: this.game.expression, blink: this.blink > 0,
      airborne: Boolean(this.jump), jumpProgress: this.jump ? this.jump.elapsed / this.jump.duration : 1,
      bodyCompression: this.body.value, platformCompression: this.tiles.get(this.game.state.step)?.value ?? 0,
      tileSprings: this.tiles.size, auraMs: this.aura, sky: skyForStep(-this.cameraY / CONFIG.stairs.stepY),
      buttons: { turn: this.buttons.turn.value, climb: this.buttons.climb.value },
      ripples: this.ripples.filter((ripple) => ripple.life > 0).map((ripple) => ({ ...ripple })),
      reducedMotion: this.reducedMotion,
    };
  }

  polygon(points,fill,stroke=null,width=2){this.art.poly(points,fill,stroke,width);}
  rect(x,y,w,h,fill,r=0,stroke=null){this.art.rect(x,y,w,h,fill,r,stroke);}
  ellipse(x,y,rx,ry,fill){this.art.ellipse(x,y,rx,ry,fill);}

  text(value, x, y, size, fill = '#fff', align = 'left', weight = 800) {
    const c = this.ctx;
    c.font = weight + ' ' + size + 'px system-ui, sans-serif';
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

  box(x, y, w, h, d, colors) {
    this.art.block(x,y,w,h,d,...colors);
  }

  coin(x, y, scale = 1) {
    this.art.coin(x, y, scale);
  }

  arrow(x, y, direction, scale, color = '#fff') {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(scale * direction, scale);
    this.polygon([[-24, -7], [4, -7], [4, -23], [30, 0], [4, 23], [4, 7], [-24, 7]], color, '#0b132b', 5);
    c.restore();
  }

  screenY(y) { return CONFIG.motion.anchorY + y - this.cameraY; }

  background() {
    if(typeof OffscreenCanvas!=='function'){this.paintBackground();return;}
    // Slow parallax moves less than half a logical pixel per sample. Composite at full RAF rate.
    const changed=!this.backdrop||this.backdrop.width!==this.canvas.width||this.backdrop.height!==this.canvas.height;
    if(changed){this.backdrop=new OffscreenCanvas(this.canvas.width,this.canvas.height);this.backdropAt=-Infinity;}
    if(this.time-this.backdropAt>=1000/20){
      const previous=this.ctx,art=this.art;this.ctx=this.backdrop.getContext('2d',{alpha:false});this.art=new Art(this.ctx);
      this.ctx.setTransform(this.canvas.width/720,0,0,this.canvas.height/1280,0,0);
      try{this.paintBackground();}finally{this.ctx=previous;this.art=art;}
      this.backdropAt=this.time;
    }
    this.ctx.globalCompositeOperation='copy';this.ctx.drawImage(this.backdrop,0,0,720,1280);this.ctx.globalCompositeOperation='source-over';
  }

  paintBackground() {
    const c = this.ctx;
    const sky = skyForStep(-this.cameraY / CONFIG.stairs.stepY);
    const gradient = c.createLinearGradient(0, 0, 0, CONFIG.view.height);
    sky.colors.forEach((color, i) => gradient.addColorStop(i / 2, color));
    c.fillStyle = gradient; c.fillRect(0, 0, 720, 1280);
    this.cachedLayer('glow:'+(sky.night>0.5),0,0,[0,0,720,1000],()=>{
    const c=this.ctx;const glow = c.createRadialGradient(570, 340, 0, 570, 340, 420);
    glow.addColorStop(0, sky.night > 0.5 ? '#d190ff24' : '#fffab54d'); glow.addColorStop(1, '#ffffff00');
    c.fillStyle = glow; c.fillRect(0, 0, 720, 1000);
    });
    c.save(); c.globalAlpha = 1 - sky.night;
    this.ellipse(574, 320, 69, 69, '#fff4bb29'); this.ellipse(574, 320, 48, 48, '#fff8d4');
    c.restore();
    if (sky.night > 0) {
      c.save(); c.globalAlpha = sky.night;
      c.translate(576, 333); c.rotate(-0.35);
      c.strokeStyle = '#c8a9f659'; c.lineWidth = 13; c.beginPath(); c.ellipse(0, 0, 89, 23, 0, 0, Math.PI); c.stroke();
      const planet = c.createLinearGradient(-45, -45, 45, 45);
      planet.addColorStop(0, '#e4cbff'); planet.addColorStop(0.45, '#a699ed'); planet.addColorStop(1, '#6059a7');
      this.ellipse(0, 0, 49, 49, planet);
      c.strokeStyle = '#e6c4ff'; c.beginPath(); c.ellipse(0, 0, 89, 23, 0, Math.PI, TAU); c.stroke();
      c.restore();
      for (let i = 0; i < this.stars.length; i += 1) {
        const star = this.stars[i];
        const y = (star.y - this.cameraY * 0.025) % 1120;
        c.globalAlpha = sky.night * (this.reducedMotion ? 0.65 : 0.55 + Math.sin(this.time / 900 + i) * 0.3);
        if (i % 7 === 0) this.star(star.x, y, star.size * 1.8, '#e3efff');
        else this.ellipse(star.x, y, star.size / 2, star.size / 2, '#e3efff');
      }
      c.globalAlpha = 1;
    }
    for (const cloud of this.clouds) {
      const x = ((cloud.x + (this.reducedMotion ? 0 : this.time / 1000 * cloud.speed) + 180) % 1080) - 180;
      const y = ((cloud.y - this.cameraY * cloud.depth + 150) % 1250) - 150;
      c.save(); c.translate(x, y); c.scale(cloud.scale, cloud.scale);
      c.globalAlpha = (1 - sky.night * 0.91) * (0.25 + cloud.depth);
      this.cachedLayer('cloud',0,0,[-112,-40,224,90],()=>{
      this.rect(-99, 3, 202, 41, '#9fc4e8', 20);
      this.rect(-106, -5, 202, 36, '#f6ffff', 18);
      this.rect(-69, -33, 74, 53, '#fff', 19);
      this.rect(-8, -23, 69, 45, '#effcff', 16);
      this.rect(-53, -29, 48, 6, '#ffffffb0', 3);
      });
      c.restore();
    }
    for (let i = 0; i < 4; i += 1) {
      const x = (i * 239 + 73) % 790 - 30;
      const y = (740 + i * 147 - this.cameraY * 0.12) % 1300;
      c.save(); c.globalAlpha = 0.14; c.translate(x, y);
      this.polygon([[-90, 0], [0, 34], [90, 0], [28, 113], [-29, 77]], '#3c377d');
      this.polygon([[-90, 0], [0, -35], [90, 0], [0, 34]], '#dbfff7');
      c.restore();
    }
    // Giant Cloud Lighthouse Tower rising in the center-background behind the stairs
    const towerShift = (-this.cameraY * 0.18) % 240;
    c.save();
    c.globalAlpha = 0.22;
    this.rect(250, 180, 220, 860, '#1b3b63', 12);
    for (let i = -1; i < 5; i += 1) {
      const ty = 220 + i * 240 + towerShift;
      this.rect(236, ty, 248, 28, '#e0675a', 6);
      this.rect(268, ty + 48, 56, 86, '#ffe89c', 14);
      this.rect(396, ty + 48, 56, 86, '#ffe89c', 14);
    }
    c.restore();
    // Distant Cel-Shaded Cloud Lighthouse Tower guiding the Starlight Express
    const lhY = 660 - clamp(-this.cameraY * 0.035, 0, 260);
    c.save(); c.globalAlpha = 0.78; c.translate(108, lhY);
    const sweep = this.reducedMotion ? 0.2 : Math.sin(this.time / 900) * 0.28;
    this.polygon([[0, -138], [290, -220 + sweep * 90], [290, -85 + sweep * 90]], '#fff6b546');
    this.rect(-36, -2, 72, 22, '#0b132b', 6);
    this.rect(-33, 0, 66, 18, '#475569', 4);
    this.rect(-27, -113, 54, 114, '#0b132b', 6);
    this.rect(-24, -110, 48, 110, '#ffffff', 4);
    this.rect(-24, -92, 48, 22, '#ff2a6d', 2);
    this.rect(-24, -48, 48, 22, '#ff2a6d', 2);
    this.rect(-32, -122, 64, 14, '#0b132b', 5);
    this.rect(-20, -146, 40, 26, '#ffbe0b', 6, '#0b132b');
    this.art.stud(0, -148, 12, 4, 5, '#ff9f1c', '#fff5bd');
    c.restore();
  }

  platform(step) {
    const { state } = this.game;
    const x = step.x;
    const y = this.screenY(step.y) + (this.tiles.get(step.id)?.value ?? 0) * (this.reducedMotion ? 0.25 : 1);
    if (y < CONFIG.motion.clipTop - 100 || y > CONFIG.view.height) return;
    const next = step.id === state.step + 1;
    const current = step.id === state.step;
    const stepped = step.id <= state.step;
    const bridgeGate = step.id > 0 && step.id % CONFIG.puzzle.everySteps === 0;
    const milestone = step.id > 0 && step.id % 10 === 0;
    // Stepping on a block permanently transforms it from a cool cyan/indigo brick into a lit golden power block!
    const palette = bridgeGate ? ['#fff199', '#f2a93b', '#ad5d28']
      : stepped || milestone ? ['#ffe888', '#e5aa47', '#ad7135']
      : step.id % 4 === 0 ? ['#c7bdff', '#9376dc', '#6559b0'] : ['#a9f6e6', '#4ebebc', '#318f9f'];
    this.cachedLayer('tile:'+palette[0]+':'+next+':'+stepped,x,y,[-110,-50,220,155],()=>this.platformBody(0,0,palette,next,stepped));
    if (bridgeGate) {
      this.rect(x - 66, y - 74, 132, 30, '#133154e6', 11, '#ffe885');
      this.text('★ ' + step.id + '층 등대 다리', x, y - 59, 15, '#fff3b0', 'center');
    } else if (milestone && step.id !== state.step) {
      this.rect(x - 36, y - 62, 72, 24, '#163458cc', 9, '#ffd87588');
      this.text(step.id + '층', x, y - 50, 14, '#ffe89c', 'center');
    } else if (step.id > state.step && step.id <= state.step + 6) {
      const bob = this.reducedMotion ? 0 : Math.sin(this.time / 330 + step.id) * 4;
      this.ellipse(x, y - 2, 16, 5, '#26325514');
      this.coin(x, y - 53 + bob, next ? 0.9 : 0.66);
    }
  }

  // Bake immutable lighting into a small atlas; keep motion, contact bounce and coins live.
  cachedLayer(key,x,y,bounds,paint) {
    const [left,top,w,h]=bounds;
    if(typeof OffscreenCanvas!=='function'){this.ctx.save();this.ctx.translate(x,y);paint();this.ctx.restore();return;}
    // Match the backing pixel density: repeated 2x downsampling was the raster bottleneck.
    const scale=this.ratio;
    if(this.layerRatio!==scale){this.layers.clear();this.layerRatio=scale;}
    let surface=this.layers.get(key);
    if(!surface){
      surface=new OffscreenCanvas(Math.ceil(w*scale),Math.ceil(h*scale));const previous=this.ctx,art=this.art;
      this.ctx=surface.getContext('2d');this.art=new Art(this.ctx);this.ctx.scale(scale,scale);this.ctx.translate(-left,-top);
      try{paint();}finally{this.ctx=previous;this.art=art;}
      this.layers.set(key,surface);
    }
    this.ctx.drawImage(surface,x+left,y+top,surface.width/scale,surface.height/scale);
  }

  platformBody(x,y,palette,next,stepped=false) {
    // Cel-Shaded 3D Isometric Mecha-Block Platform with Bold #0b132b Ink Contour & Glowing Studs!
    this.ellipse(x+6,y+64,74,16,'#07142b4d');
    if (next || stepped) {
      this.ctx.save(); this.ctx.globalAlpha = stepped ? 0.42 : 0.32;
      this.polygon([[x - 92, y + 6], [x, y - 34], [x + 92, y + 6], [x, y + 46]], stepped ? '#ffbe0b' : '#00f5d4');
      this.ctx.restore();
    }
    const topCol = stepped ? '#ffe66d' : palette[0];
    const leftCol = stepped ? '#ffbe0b' : palette[1];
    const rightCol = stepped ? '#d97706' : palette[2];
    this.polygon([[x - 80, y + 4], [x, y + 34], [x, y + 72], [x - 80, y + 42]], leftCol, '#0b132b', 3.5);
    this.polygon([[x, y + 34], [x + 80, y + 4], [x + 80, y + 42], [x, y + 72]], rightCol, '#0b132b', 3.5);
    this.polygon([[x - 80, y + 4], [x, y - 26], [x + 80, y + 4], [x, y + 34]], topCol, '#0b132b', 3.5);
    for (const [dx, dy] of [[-30, 4], [0, -7], [30, 4], [0, 15]]) {
      this.art.stud(x + dx, y + dy, 10, 4, stepped ? 3 : 6, leftCol, topCol);
    }
    if (stepped) this.star(x, y + 4, 11, '#ffffff');
  }

  avatar() {
    const c = this.ctx; const { state } = this.game;
    const palette = this.game.wallet?.palette ?? AVATAR_PALETTE;
    const { x, y, lift } = this.pose;
    const tile = !this.jump ? (this.tiles.get(state.step)?.value ?? 0) * (this.reducedMotion ? 0.25 : 1) : 0;
    const sy = this.screenY(y) + tile;
    const flight = this.jump && !this.reducedMotion ? Math.sin(this.jump.elapsed / this.jump.duration * Math.PI) : 0;
    const crouch = this.reducedMotion ? 0 : clamp(this.body.value, -0.25, 1);
    const breath = this.reducedMotion || this.jump ? 0 : Math.sin(this.time / CONFIG.motion.idlePeriodMs * TAU) * CONFIG.motion.idleAmplitude;
    const shadowScale = 1 - Math.min(lift / 160, 0.45);
    this.ellipse(x + 3, sy + 6, 48 * shadowScale, 15 * shadowScale, '#0d234248');
    if (this.aura > 0) {
      c.save(); const strength = Math.min(1, this.aura / 350);
      c.globalAlpha = strength;
      const aura = c.createRadialGradient(x, sy - lift - 105, 10, x, sy - lift - 105, 155);
      aura.addColorStop(0, '#7effe855'); aura.addColorStop(0.5, '#ffe37238'); aura.addColorStop(1, '#ffdd5500');
      c.fillStyle = aura; c.fillRect(x - 165, sy - lift - 270, 330, 330);
      c.strokeStyle = '#7effe8'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(x, sy - lift - 95, 88 + Math.sin(this.time / 100) * 5, 112, -0.2, 0, TAU); c.stroke();
      c.restore();
    }
    c.save(); c.translate(x, sy - lift + breath);
    this.art.toy(0, 0, 1.32, {
      time: this.time,
      run: Boolean(this.jump),
      jump: flight,
      squash: crouch * 0.55,
      turn: state.facing * 0.45,
      hurt: state.mode === MODE.STUMBLE,
      gold: state.combo >= 10 || state.mode === MODE.AUTO_CLIMB,
      glow: this.aura > 0 ? 1 : 0,
      palette,
    });
    if (state.mode === MODE.STUMBLE) {
      for (let i = 0; i < 3; i += 1) {
        const angle = (this.reducedMotion ? 0 : this.time / 240) + i * TAU / 3;
        this.star(Math.cos(angle) * 56, -242 + Math.sin(angle) * 14, 11, '#fff298');
      }
    } else {
      this.arrow(state.facing * 64, -172, state.facing, 0.54, '#7effe8');
    }
    c.restore();
  }

  hud() {
    // Infinite Stairs (무한의 계단) Minimalist Open-Sky HUD (No giant dark-navy boxes covering the top of the sky!)
    const c = this.ctx; const { state } = this.game;
    // Floating Top-Right Coin Pill
    this.rect(532, 26, 164, 58, '#0b132b', 29);
    this.rect(535, 29, 158, 52, '#1e293b', 26, '#ffbe0b');
    this.coin(566, 55, 0.58);
    const coins = this.game.wallet?.coins ?? state.coins;
    this.art.counter(coins, 634, 56, 92, 26, '#ffbe0b');
    // Giant Floating Outlined Floor Counter in Top-Center Sky
    this.art.label(state.step + '층', 360, 88, state.step > 9999 ? 46 : 64, '#ffffff', '#0b132b');
    const bridgeLeft = Math.max(0, state.nextPuzzle - state.step);
    const bridgeProgress = clamp(1 - bridgeLeft / CONFIG.puzzle.everySteps, 0, 1);
    this.rect(228, 134, 264, 16, '#0b132b', 8);
    this.rect(232, 137, Math.max(12, 256 * bridgeProgress), 10, state.step >= CONFIG.sky.stratosphereStep ? '#ffbe0b' : '#00f5d4', 5);
    if (state.combo > 1) {
      c.save(); c.translate(360, 182);
      const elapsed = CONFIG.motion.auraMs - this.aura;
      const pulse = !this.reducedMotion && this.aura > 0 && elapsed < 300 ? 1 + Math.sin(elapsed / 300 * Math.PI) * 0.12 : 1;
      c.scale(pulse, pulse);
      this.art.label('⚡ 콤보 ×' + state.combo, 0, 0, 26, '#ffbe0b', '#0b132b');
      c.restore();
    }
  }

  hudBackground() {}

  controls() {
    const c = this.ctx;
    const top = CONFIG.view.height * (1 - CONFIG.view.controlFraction);
    const fade = c.createLinearGradient(0, top - 40, 0, top + 40);
    fade.addColorStop(0, '#16294d00'); fade.addColorStop(1, '#16294df5');
    c.fillStyle = fade; c.fillRect(0, top - 40, 720, 322);
    const blocked = ![MODE.PLAYING, MODE.BRAKE_WARNING].includes(this.game.state.mode);
    for (const [i, action] of [ACTION.TURN, ACTION.CLIMB].entries()) {
      const x = 24 + i * 360;
      const depth = clamp(this.buttons[action].value, -3, 18) * (this.reducedMotion ? 0.35 : 1);
      const y = top + 25 + depth;
      const colors = blocked ? ['#a6b7d1', '#788aa7', '#4a607f'] : i === 0 ? ['#b4a0ff', '#8f68ea', '#503c91'] : ['#ffdf84', '#ffb54c', '#a46232'];
      this.cachedLayer('button-base:'+colors[2],x,top+36,[-6,0,324,222],()=>{
        this.rect(-4,2,320,218,'#0b1b35',100,'#92b5e329');
        this.rect(0,0,312,199,colors[2],96);
      });
      this.cachedLayer('button-face:'+action+':'+colors[0],x,y,[-2,-2,316,194],()=>this.buttonFace(action,colors));
      c.save(); c.beginPath(); c.roundRect(x + 4, y + 4, 304, 182, 90); c.clip();
      for (const ripple of this.ripples) {
        if (ripple.action !== action || ripple.life <= 0) continue;
        const age = 1 - ripple.life / CONFIG.motion.rippleMs;
        c.globalAlpha = (1 - age) * 0.55;
        const radius = 8 + smooth(age) * 190;
        c.lineWidth = 4 - age * 2; c.strokeStyle = '#fff';
        c.beginPath(); c.arc(ripple.x, ripple.y + depth, radius, 0, TAU); c.stroke();
        this.ellipse(ripple.x, ripple.y + depth, radius, radius, '#ffffff0c');
      }
      c.restore();

    }
    this.rect(302, 1254, 116, 5, '#7593b04a', 3);
  }

  buttonFace(action,colors) {
    // Commercial Brawl-Arcade Bevelled Tactile Trigger Button with Thick #0b132b Outline
    const c=this.ctx,fill=c.createLinearGradient(0,0,0,190);
    const topC=action===ACTION.TURN?'#7209b7':'#ff9f1c';
    const botC=action===ACTION.TURN?'#3a0ca3':'#e85d04';
    fill.addColorStop(0,topC);fill.addColorStop(1,botC);
    this.rect(0,0,312,188,fill,42,'#0b132b');
    this.rect(8,8,296,74,'#ffffff24',32);
    c.save(); c.translate(156,82);
    if (action === ACTION.TURN) {
      this.arrow(-8, -14, -1, 1.25, '#0b132b'); this.arrow(8, 22, 1, 1.25, '#0b132b');
      this.arrow(-8, -18, -1, 1.25, '#00f5d4'); this.arrow(8, 18, 1, 1.25, '#ffffff');
    } else {
      c.save(); c.translate(0, 4); c.rotate(-Math.PI / 2);
      this.arrow(-4, 0, 1, 1.45, '#0b132b'); this.arrow(0, 0, 1, 1.45, '#fff3b0');
      c.restore();
    }
    c.restore();
    this.art.label(action===ACTION.TURN?'방향 전환':'점프 오르기',156,154,24,'#ffffff','#0b132b');
  }

  brakeOverlay() {
    const s = this.game.state, c = this.ctx, a = this.art;
    if (s.mode === MODE.AUTO_CLIMB) {
      a.rect(135,300,450,114,'#0b132bf2',28,'#ffbe0b');
      a.label('🚀 스타 부스터 점프!',360,340,36,'#ffbe0b','#0b132b'); a.label('5단 초고속 상승 · +' + CONFIG.brake.coins,360,384,24,'#00f5d4','#0b132b');
      return;
    }
    if (![MODE.BRAKE_WARNING, MODE.BRAKE_HOLD].includes(s.mode)) return;
    const warning = s.mode === MODE.BRAKE_WARNING, color = warning ? '#ffe583' : '#ff657d';
    c.strokeStyle=color;c.lineWidth=12;c.beginPath();c.roundRect(8,8,704,1264,26);c.stroke();
    a.rect(210,294,300,165,'#172a51eb',34,color);
    a.text(warning?'⚡ 돌풍 예고!':'🛑 멈춰! 부스터 충전',360,327,25,color);
    a.rect(338,370,44,48,color,14);
    for(let i=0;i<4;i++) a.rect(338+i*11,348-(i===1||i===2?8:0),9,43,color,5);
    a.rect(323,382,18,29,color,8);
    c.strokeStyle=color;c.lineWidth=5;c.beginPath();c.arc(360,384,55,-Math.PI/2,-Math.PI/2+Math.PI*2*(s.brakeRemainingMs/(warning?CONFIG.brake.warningMs:CONFIG.brake.holdMs)));c.stroke();
  }

  render(canHome = false) {
    const c = this.ctx;
    c.setTransform(this.ratio, 0, 0, this.canvas.height / CONFIG.view.height, 0, 0);
    this.background();
    c.save();
    c.beginPath(); c.rect(0, CONFIG.motion.clipTop, 720, CONFIG.view.height * (1 - CONFIG.view.controlFraction) - CONFIG.motion.clipTop); c.clip();
    if (this.shake > 0 && !this.reducedMotion) {
      const amplitude = this.game.state.mode === MODE.STUMBLE ? CONFIG.motion.stumbleShakePx : CONFIG.motion.shakePx;
      c.translate(Math.sin(this.time * 0.11) * amplitude * this.shake / CONFIG.motion.shakeMs, Math.cos(this.time * 0.08) * amplitude * this.shake / CONFIG.motion.shakeMs);
    }
    for (let i = this.game.steps.length - 1; i >= 0; i -= 1) this.platform(this.game.steps[i]);
    if (!this.reducedMotion && (this.game.state.combo >= 5 || this.game.state.mode === MODE.AUTO_CLIMB)) {
      c.save();
      c.globalAlpha = this.game.state.mode === MODE.AUTO_CLIMB ? 0.5 : Math.min(0.38, this.game.state.combo * 0.025);
      for (let i = 0; i < 8; i += 1) {
        const lx = i < 4 ? 26 + i * 22 : 616 + (i - 4) * 22;
        const ly = 220 + ((this.time * 1.4 + i * 170) % 680);
        this.rect(lx, ly, 4, 85, this.game.state.mode === MODE.AUTO_CLIMB ? '#00f5d4' : '#ffbe0b', 2);
      }
      c.restore();
    }
    this.avatar();
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      c.save(); c.globalAlpha = Math.min(1, particle.life / 220);
      c.translate(particle.x, this.screenY(particle.y)); c.rotate(particle.rotation);
      this.star(0, 0, particle.size * 0.72, '#0b132b');
      this.star(0, 0, particle.size * 0.54, particle.color);
      c.restore();
    }
    for (const popup of this.popups) {
      if (popup.life <= 0 || (!popup.bonus && this.popups.some((other) => other.bonus && other.life > 0))) continue;
      c.save(); c.globalAlpha = Math.min(1, popup.life / 200);
      const x = clamp(popup.x + (popup.x >= 360 ? 105 : -105), 68, 652); const y = this.screenY(popup.y) - 38;
      this.art.label('+' + (CONFIG.rules.stepCoins + popup.bonus), x, y, popup.bonus ? 42 : 28, '#ffbe0b', '#0b132b'); c.restore();
    }
    c.restore(); this.hud(); this.controls(); this.brakeOverlay(); this.art.home(canHome);
  }
}
