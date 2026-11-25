import { ACTION, CONFIG, MODE } from './config.js';
import { Art } from './art.js';
import { AVATAR_PALETTE } from './profile.js';

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
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(scale, scale);
    this.polygon([[-19, -11], [0, -22], [19, -11], [19, 12], [0, 24], [-19, 12]], '#cf872c', '#826038', 2);
    this.polygon([[-16, -13], [0, -23], [16, -13], [16, 8], [0, 18], [-16, 8]], '#ffe16a');
    this.rect(-4, -12, 8, 21, '#fff9cb', 2);
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
    // Distant LEGO Cloud Lighthouse Tower guiding the Starlight Express
    const lhY = 660 - clamp(-this.cameraY * 0.035, 0, 260);
    c.save(); c.globalAlpha = 0.42; c.translate(108, lhY);
    const sweep = this.reducedMotion ? 0.2 : Math.sin(this.time / 900) * 0.28;
    this.polygon([[0, -138], [260, -210 + sweep * 90], [260, -90 + sweep * 90]], '#fff6b536');
    this.rect(-34, 0, 68, 18, '#65809e', 4);
    this.rect(-24, -110, 48, 110, '#e8f1fa', 4);
    this.rect(-24, -92, 48, 22, '#e0675a', 2);
    this.rect(-24, -48, 48, 22, '#e0675a', 2);
    this.rect(-30, -120, 60, 12, '#3a5778', 4);
    this.rect(-18, -144, 36, 24, '#ffe89c', 5);
    this.art.stud(0, -148, 14, 4.5, 6, '#e39d3b', '#fff5bd');
    c.restore();
  }

  platform(step) {
    const { state } = this.game;
    const x = step.x;
    const y = this.screenY(step.y) + (this.tiles.get(step.id)?.value ?? 0) * (this.reducedMotion ? 0.25 : 1);
    if (y < CONFIG.motion.clipTop - 100 || y > CONFIG.view.height) return;
    const next = step.id === state.step + 1;
    const current = step.id === state.step;
    const palette = current ? ['#ffe888', '#e5aa47', '#ad7135'] : step.id % 4 === 0
      ? ['#c7bdff', '#9376dc', '#6559b0'] : ['#a9f6e6', '#4ebebc', '#318f9f'];
    this.cachedLayer('tile:'+palette[0]+':'+next,x,y,[-110,-50,220,155],()=>this.platformBody(0,0,palette,next));
    if (step.id > state.step && step.id <= state.step + 6) {
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

  platformBody(x,y,palette,next) {
    this.ellipse(x+10,y+83,82,17,'#1a2d5830');
    if (next) {
      this.ctx.save(); this.ctx.globalAlpha = 0.34;
      this.polygon([[x - 102, y], [x, y - 40], [x + 102, y], [x, y + 40]], '#fffdd5');
      this.ctx.restore();
    }
    this.polygon([[x - 88, y], [x, y + 32], [x, y + 80], [x - 88, y + 48]], palette[1], '#245066', 2);
    this.polygon([[x, y + 32], [x + 88, y], [x + 88, y + 48], [x, y + 80]], palette[2], '#245066', 2);
    this.polygon([[x - 88, y], [x, y - 32], [x + 88, y], [x, y + 32]], palette[0], next ? '#ffffed' : '#dcfff2', next ? 4 : 2);
    this.polygon([[x - 88, y + 6], [x, y + 38], [x, y + 44], [x - 88, y + 12]], '#ffffff26');
    this.polygon([[x + 8, y + 42], [x + 78, y + 17], [x + 78, y + 22], [x + 8, y + 47]], '#00072b12');
    for (const [dx, dy] of [[-33, 0], [0, -12], [33, 0], [0, 12]]) {
      this.ellipse(x + dx, y + dy + 2, 13, 5, '#19374838');
      this.rect(x + dx - 12, y + dy - 7, 24, 7, palette[1], 2);
      this.ellipse(x + dx, y + dy - 7, 12, 4.6, palette[0]);
      this.ellipse(x + dx, y + dy - 7.5, 8.5, 3, '#ffffff88');
    }
  }

  limb(kind, side, stride, crouch, flight) {
    const c = this.ctx;
    const arm = kind === 'arm';
    const angle = stride * side * (arm ? 0.9 : -0.65) * flight;
    c.save(); c.translate(side * (arm ? 48 : 20), arm ? -146 : -73);
    c.rotate(angle + (arm ? side * (0.09 + crouch * 0.25) : side * crouch * 0.26));
    if (arm) {
      this.box(-13, 0, 26, 27, 7, ['#f67962', '#ffa18a', '#ba4f5d']);
      c.translate(0, 29); c.rotate(-side * (0.08 + flight * 0.35));
      this.box(-12, 0, 24, 25, 7, ['#ffd18b', '#ffe6b2', '#c99a64']);
      this.rect(-6, 22, 12, 6, '#d9a461', 2);
      c.beginPath(); c.arc(0, 33, 9.5, -0.25 * Math.PI, 1.25 * Math.PI);
      c.strokeStyle = '#ffcf6e'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke();
      c.beginPath(); c.arc(0, 33, 9.5, 0.1 * Math.PI, 0.9 * Math.PI);
      c.strokeStyle = '#fff4c2'; c.lineWidth = 2.2; c.stroke();
    } else {
      this.box(-14, 0, 28, 31, 8, ['#385b85', '#6686b0', '#253b61']);
      c.translate(0, 32); c.rotate(side * crouch * -0.58 + stride * side * flight * 0.25);
      this.box(-14, 0, 28, 27, 8, ['#2d466c', '#496e99', '#203455']);
      this.rect(-9, 5, 18, 8, '#50749c', 2);
      this.box(-17, 27, 34, 12, 9, ['#effbff', '#fff', '#a5bfd5']);
      this.rect(-15, 36, 30, 4, '#49c8cf', 1);
    }
    c.restore();
  }

  face(expression) {
    const c = this.ctx; const look = this.game.state.facing * 3;
    const blink = this.blink > 0 ? Math.sin(this.blink / CONFIG.motion.blinkMs * Math.PI) : 0;
    for (const eye of [-15, 13]) {
      const x = eye + look;
      if (expression === 'dizzy') {
        c.strokeStyle = '#333758'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath();
        for (let i = 0; i <= 50; i += 1) {
          const angle = i / 50 * TAU * 2.2 + this.time / 200;
          const r = 0.8 + i / 50 * 7.5;
          const px = x + Math.cos(angle) * r; const py = -181 + Math.sin(angle) * r;
          if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.stroke();
      } else if (blink > 0.75) {
        this.rect(x - 5, -182, 10, 3, '#30334b', 2);
      } else if (expression === 'star') {
        this.star(x, -182, 11, '#c97b27'); this.star(x, -183, 8.5, '#fff65f');
        this.ellipse(x - 2, -186, 2, 2, '#fff');
      } else {
        this.rect(x - 4, -188, 8, 13 * (1 - blink * 0.65), '#2c354b', 4);
        this.ellipse(x - 1, -185, 1.8, 2.2, '#fff');
        c.strokeStyle = '#826039'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
        c.moveTo(x - 6, -196 + (eye < 0 ? 2 : 0)); c.lineTo(x + 5, -196 + (eye < 0 ? 0 : 2)); c.stroke();
      }
    }
    this.ellipse(-23, -172, 6, 3, '#f49c795e'); this.ellipse(24, -172, 6, 3, '#f49c795e');
    if (expression === 'dizzy') {
      c.strokeStyle = '#91504b'; c.lineWidth = 3; c.beginPath();
      c.moveTo(-9, -163); c.quadraticCurveTo(-4, -170, 1, -163); c.quadraticCurveTo(7, -157, 12, -164); c.stroke();
    } else {
      c.beginPath(); c.moveTo(-11 + look, -169); c.quadraticCurveTo(1 + look, -151, 14 + look, -170);
      c.quadraticCurveTo(1 + look, -165, -11 + look, -169); c.fillStyle = '#713c43'; c.fill();
      c.beginPath(); c.moveTo(-8 + look, -168); c.quadraticCurveTo(2 + look, -158, 11 + look, -168);
      c.fillStyle = '#fff7e6'; c.fill();
    }
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
    const stride = this.jump ? (this.jump.step % 2 ? 1 : -1) * this.jump.direction : 0;
    const shadowScale = 1 - Math.min(lift / 160, 0.45);
    this.ellipse(x + 5, sy + 4, 51 * shadowScale, 17 * shadowScale, '#183b6540');
    this.ellipse(x + 5, sy + 4, 31 * shadowScale, 9 * shadowScale, '#183b6525');
    if (this.aura > 0) {
      c.save(); const strength = Math.min(1, this.aura / 350);
      c.globalAlpha = strength;
      const aura = c.createRadialGradient(x, sy - lift - 110, 10, x, sy - lift - 110, 160);
      aura.addColorStop(0, '#fff7ae50'); aura.addColorStop(0.45, '#ffe37240'); aura.addColorStop(1, '#ffdd5500');
      c.fillStyle = aura; c.fillRect(x - 170, sy - lift - 280, 340, 340);
      c.strokeStyle = '#fff2a7'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(x, sy - lift - 90, 93 + Math.sin(this.time / 100) * 5, 119, -0.25, 0, TAU); c.stroke();
      for (let i = 0; i < 6; i += 1) {
        const angle = i * TAU / 6 + (this.reducedMotion ? 0 : this.time / 500);
        this.star(x + Math.cos(angle) * 112, sy - lift - 110 + Math.sin(angle) * 110, 7, '#fff4b4');
      }
      c.restore();
    }
    c.save(); c.translate(x, sy - lift + breath);
    if (state.mode === MODE.STUMBLE && !this.reducedMotion) c.rotate(Math.sin(this.time / 70) * 0.12);
    else c.rotate(flight * (this.jump?.direction ?? 0) * 0.07);
    c.scale(1 + crouch * 0.13 - flight * 0.05, 1 - crouch * 0.15 + flight * 0.1);
    this.art.gear(palette.parts,this.time,'back',1.37);
    const far = -state.facing; const near = state.facing;
    this.limb('arm', far, stride, crouch, flight);
    this.limb('leg', far, stride, crouch, flight);
    this.limb('leg', near, stride, crouch, flight);
    this.box(-37, -147, 74, 69, 11, [palette.shirt, palette.shirtTop, palette.shirtSide]);
    this.rect(-28, -140, 12, 52, '#bd515d', 3);
    this.rect(22, -140, 8, 52, '#ffb897', 2);
    this.rect(-12, -135, 31, 36, '#fff3d9', 8, '#eab897');
    this.star(3, -117, 11, '#efb33e');
    this.rect(-35, -85, 70, 10, '#244364', 3);
    this.rect(-7, -86, 17, 11, '#ffdc74', 3);
    this.box(-11, -157, 24, 9, 7, ['#efbb7d', '#ffdfa6', '#b98a5d']);
    this.box(-33, -211, 66, 56, 10, ['#ffda96', '#ffedbc', '#cba06c']);
    this.rect(-31, -207, 7, 41, '#eabd7b', 3);
    // Rounded LEGO block helmet, top LEGO stud, split rim and glossy inset.
    this.art.stud(0, -230, 16, 5.5, 8, palette.helmet, palette.helmetTop);
    this.box(-40, -224, 79, 23, 11, [palette.helmet, palette.helmetTop, palette.helmetSide]);
    this.rect(-32, -219, 61, 6, '#bafff5', 3);
    this.rect(-42, -202, 12, 26, '#36b5c5', 4, '#25607a');
    this.rect(34, -202, 11, 26, '#248eab', 4, '#25607a');
    this.rect(-39, -205, 81, 7, '#52e0de', 3);
    this.face(this.game.expression);
    this.art.gear(palette.parts,this.time,'front',1.37);
    this.limb('arm', near, stride, crouch, flight);
    if (state.mode === MODE.STUMBLE) {
      for (let i = 0; i < 3; i += 1) {
        const angle = (this.reducedMotion ? 0 : this.time / 240) + i * TAU / 3;
        this.star(Math.cos(angle) * 57, -251 + Math.sin(angle) * 14, 11, '#fff298');
      }
    } else this.arrow(state.facing * 89, -112, state.facing, 0.58, '#fff5a8');
    c.restore();
  }

  hud() {
    const c = this.ctx; const { state } = this.game;
    this.cachedLayer('hud',0,0,[0,0,720,228],()=>this.hudBackground());
    this.text(state.step, 126, 152, state.step > 99999 ? 34 : 48, '#fff');
    const coins = this.game.wallet?.coins ?? state.coins;
    this.text(coins, 436, 152, coins > 999999 ? 26 : coins > 99999 ? 34 : 48, '#fff4b2');
    const bridgeLeft = Math.max(0, state.nextPuzzle - state.step);
    const bridgeProgress = clamp(1 - bridgeLeft / CONFIG.puzzle.everySteps, 0, 1);
    this.rect(140, 202, 440, 22, '#102549cc', 11, '#8be9ff4d');
    this.rect(144, 206, Math.max(14, 432 * bridgeProgress), 14, '#58e6d0', 7);
    this.text('등대 레고 브릿지까지 ' + bridgeLeft + '층 (+50 코인)', 360, 213, 13.5, '#fff7cc', 'center');
    if (state.combo > 1) {
      c.save(); c.translate(360, 258);
      const elapsed = CONFIG.motion.auraMs - this.aura;
      const pulse = !this.reducedMotion && this.aura > 0 && elapsed < 300 ? 1 + Math.sin(elapsed / 300 * Math.PI) * 0.12 : 1;
      c.scale(pulse, pulse);
      this.rect(-82, -26, 164, 59, '#1a2c6099', 25, '#c9e3ff29');
      this.polygon([[-43, -18], [-56, 0], [-43, 0], [-48, 13], [-25, -8], [-39, -8]], '#ffe57a');
      this.text('×' + state.combo, 15, -3, 28, '#fff5ba', 'center');
      for (let i = 0; i < 10; i += 1) this.rect(-49 + i * 10, 21, 7, 4, i < (state.combo % 10 || 10) ? '#ffe484' : '#ffffff26', 2);
      c.restore();
    }
  }

  hudBackground() {
    const c=this.ctx;
    const shade = c.createLinearGradient(0, 0, 0, 228);
    shade.addColorStop(0, '#142957db'); shade.addColorStop(1, '#14295700');
    c.fillStyle = shade; c.fillRect(0, 0, 720, 228);
    this.text('작전 2 · 구름 등대 신호탑', 139, 48, 27, '#ecffff');
    for (const [x, width] of [[28, 312], [356, 336]]) {
      this.rect(x, 118, width, 80, '#11275045', 25);
      this.rect(x, 112, width, 80, '#1835578c', 25, '#c2f5ff4a');
      this.rect(x + 20, 115, width - 40, 3, '#ffffff26', 2);
    }
    this.rect(54, 157, 12, 16, '#9aefef', 3); this.rect(70, 142, 12, 31, '#9aefef', 3); this.rect(86, 126, 12, 47, '#c8ffff', 3);
    this.coin(397,151,1.1);
  }

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
    const c=this.ctx,fill=c.createLinearGradient(0,0,0,190);
    fill.addColorStop(0,colors[0]);fill.addColorStop(.55,colors[1]);fill.addColorStop(1,colors[1]);
    this.rect(0,0,312,190,fill,94,'#fff5e570');
    c.save();c.beginPath();c.roundRect(4,4,304,182,90);c.clip();
    this.ellipse(156,7,130,41,'#ffffff24');this.rect(69,12,174,5,'#ffffff4f',3);c.restore();
      c.save(); c.translate(156,94);
      if (action === ACTION.TURN) {
        this.arrow(-7, -15, -1, 1.3, '#5c43947a'); this.arrow(7, 26, 1, 1.3, '#5c43947a');
        this.arrow(-7, -20, -1, 1.3, '#fff7ff'); this.arrow(7, 21, 1, 1.3, '#fff7ff');
      } else {
        for (let j = 0; j < 3; j += 1) {
          this.rect(-52 + j * 42, 39 - j * 22, 33, 14 + j * 22, '#8c542d', 4);
          this.rect(-50 + j * 42, 39 - j * 22, 29, 4, '#b07837', 2);
        }
        c.save(); c.translate(-9, -27); c.rotate(-Math.PI / 2);
        this.arrow(-4, 0, 1, 1.32, '#a3713b'); this.arrow(0, 0, 1, 1.32, '#fffdf0'); c.restore();
      }
      c.restore();
  }

  brakeOverlay() {
    const s = this.game.state, c = this.ctx, a = this.art;
    if (s.mode === MODE.AUTO_CLIMB) {
      a.rect(135,300,450,114,'#17385be8',28,'#fff0a6');
      a.text('🚀 레고 로켓 점프!',360,340,36,'#fff0a6'); a.text('5단 초고속 상승 · +' + CONFIG.brake.coins,360,384,24,'#b5ffe5');
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
    this.background(); c.save();
    c.beginPath(); c.rect(0, CONFIG.motion.clipTop, 720, CONFIG.view.height * (1 - CONFIG.view.controlFraction) - CONFIG.motion.clipTop); c.clip();
    if (this.shake > 0 && !this.reducedMotion) {
      const amplitude = this.game.state.mode === MODE.STUMBLE ? CONFIG.motion.stumbleShakePx : CONFIG.motion.shakePx;
      c.translate(Math.sin(this.time * 0.11) * amplitude * this.shake / CONFIG.motion.shakeMs, Math.cos(this.time * 0.08) * amplitude * this.shake / CONFIG.motion.shakeMs);
    }
    for (let i = this.game.steps.length - 1; i >= 0; i -= 1) this.platform(this.game.steps[i]);
    this.avatar();
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      c.save(); c.globalAlpha = Math.min(1, particle.life / 220);
      c.translate(particle.x, this.screenY(particle.y)); c.rotate(particle.rotation);
      this.rect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * (0.5 + Math.abs(Math.cos(particle.rotation)) * 0.5), particle.color, 1);
      this.rect(-particle.size / 2, -particle.size / 2, particle.size, 2, '#ffffff6b', 1); c.restore();
    }
    for (const popup of this.popups) {
      if (popup.life <= 0 || (!popup.bonus && this.popups.some((other) => other.bonus && other.life > 0))) continue;
      c.save(); c.globalAlpha = Math.min(1, popup.life / 200);
      const x = clamp(popup.x + 65, 62, 660); const y = this.screenY(popup.y);
      this.text('+' + (CONFIG.rules.stepCoins + popup.bonus), x + 2, y + 3, popup.bonus ? 46 : 29, '#654b62', 'center');
      this.text('+' + (CONFIG.rules.stepCoins + popup.bonus), x, y, popup.bonus ? 46 : 29, '#fff5b6', 'center'); c.restore();
    }
    c.restore(); this.hud(); this.controls(); this.brakeOverlay(); this.art.home(canHome);
  }
}
