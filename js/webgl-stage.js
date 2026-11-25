// Real-time Open-Source OGL v1.0.11 WebGL 3D Graphics Engine Stage.
// Renders hardware-accelerated 3D LEGO bricks, cylindrical studs, mechs, train coaches,
// stair blocks, boss cranes, and 3D rigid-body fracture debris using GLSL Blinn-Phong + Fresnel shaders.
import { Renderer, Camera, Transform, Program, Mesh, Box, Cylinder, Sphere, Color, Vec3, Mat4, Quat, Euler } from './ogl.js';

const VERTEX_SHADER = `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vLocalPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vLocalPos = position;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mvPos.xyz;
  gl_Position = projectionMatrix * mvPos;
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vLocalPos;
uniform vec3 uColor;
uniform float uEmissive;
uniform float uHitFlash;
uniform float uOpacity;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPos);
  vec3 L1 = normalize(vec3(-0.52, 0.78, 0.55));
  vec3 L2 = normalize(vec3(0.62, -0.38, 0.42));
  float diff1 = max(dot(N, L1), 0.0);
  float diff2 = max(dot(N, L2), 0.0) * 0.24;
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = mix(vec3(0.14, 0.19, 0.34), vec3(0.92, 0.96, 1.0), hemi) * 0.42;
  vec3 H = normalize(L1 + V);
  float spec = pow(max(dot(N, H), 0.0), 42.0) * 0.78;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.8) * 0.34;
  vec3 edgeDist = abs(vLocalPos) * 2.0;
  float edgeSheen = smoothstep(0.85, 0.99, max(max(edgeDist.x, edgeDist.y), edgeDist.z)) * 0.18;
  vec3 col = uColor * (ambient + diff1 * 0.88 + diff2)
    + vec3(1.0, 0.98, 0.92) * (spec + edgeSheen)
    + mix(uColor, vec3(0.72, 0.95, 1.0), 0.5) * rim
    + uColor * (uEmissive * 0.45);
  col = mix(col, vec3(1.0, 0.97, 0.85), clamp(uHitFlash * 0.35, 0.0, 0.35));
  gl_FragColor = vec4(col, uOpacity);
}
`;

const CAM_Z = 20;
const FOV_DEG = 35;
const TAN_HALF_FOV = Math.tan((FOV_DEG * Math.PI) / 360);
const ASPECT = 720 / 1280;

const tmpQuat = new Quat();
const tmpEuler = new Euler();
const tmpOffset = new Vec3();

export class OGLStage {
  constructor() {
    this.width = 720;
    this.height = 1280;
    this.scene = new Transform();
    this.renderer = null;
    this.gl = null;
    this.camera = null;
    this.program = null;
    this.canvas = null;
    this.boxPool = [];
    this.cylPool = [];
    this.spherePool = [];
    this.boxCursor = 0;
    this.cylCursor = 0;
    this.sphereCursor = 0;
    this.drawCalls = 0;
    this.lastMeshCount = 0;
    this.totalFrames = 0;
    this.initAttempts = 0;
    this.colorCache = new Map();
    this.init();
  }

  init() {
    if (typeof document === 'undefined' || this.gl) return;
    this.initAttempts += 1;
    try {
      const candidate = document.createElement('canvas');
      candidate.width = this.width;
      candidate.height = this.height;
      const probe = candidate.getContext('webgl2', { alpha: true, depth: true, antialias: true, premultipliedAlpha: false })
        || candidate.getContext('webgl', { alpha: true, depth: true, antialias: true, premultipliedAlpha: false });
      if (!probe || typeof probe.getParameter !== 'function') return;

      this.canvas = candidate;
      this.renderer = new Renderer({
        canvas: this.canvas,
        width: this.width,
        height: this.height,
        dpr: 1,
        alpha: true,
        depth: true,
        antialias: true,
        premultipliedAlpha: false,
        autoClear: true,
      });
      this.gl = this.renderer.gl;
      this.gl.clearColor(0, 0, 0, 0);

      this.camera = new Camera(this.gl, {
        fov: FOV_DEG,
        aspect: ASPECT,
        near: 0.5,
        far: 100,
      });
      this.camera.position.set(0, 0, CAM_Z);

      this.program = new Program(this.gl, {
        vertex: VERTEX_SHADER,
        fragment: FRAGMENT_SHADER,
        transparent: true,
        cullFace: null,
        depthTest: true,
        depthWrite: true,
        uniforms: {
          uColor: { value: new Color('#ffcf5c') },
          uEmissive: { value: 0 },
          uHitFlash: { value: 0 },
          uOpacity: { value: 1 },
        },
      });

      this.boxGeo = new Box(this.gl, { width: 1, height: 1, depth: 1 });
      this.cylGeo = new Cylinder(this.gl, { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 16 });
      this.sphereGeo = new Sphere(this.gl, { radius: 0.5, widthSegments: 14, heightSegments: 10 });

      this.allocatePool(this.boxPool, this.boxGeo, 180);
      this.allocatePool(this.cylPool, this.cylGeo, 220);
      this.allocatePool(this.spherePool, this.sphereGeo, 56);
      this.initError = null;
    } catch (err) {
      this.initError = String(err?.message || err);
      this.gl = null;
    }
  }

  allocatePool(pool, geometry, count) {
    for (let i = 0; i < count; i++) {
      const mesh = new Mesh(this.gl, { geometry, program: this.program, frustumCulled: false });
      mesh.visible = false;
      mesh.uColor = new Color('#ffffff');
      mesh.uEmissive = 0;
      mesh.uHitFlash = 0;
      mesh.uOpacity = 1;
      mesh.onBeforeRender(() => {
        this.program.uniforms.uColor.value = mesh.uColor;
        this.program.uniforms.uEmissive.value = mesh.uEmissive;
        this.program.uniforms.uHitFlash.value = mesh.uHitFlash;
        this.program.uniforms.uOpacity.value = mesh.uOpacity;
      });
      mesh.setParent(this.scene);
      pool.push(mesh);
    }
  }

  parseColor(hex) {
    const clean = typeof hex === 'string' && /^#[\da-f]{6}/i.test(hex) ? hex.slice(0, 7) : '#ffcf5c';
    let c = this.colorCache.get(clean);
    if (!c) {
      c = new Color(clean);
      if (this.colorCache.size < 256) this.colorCache.set(clean, c);
    }
    return c;
  }

  beginPass() {
    if (!this.gl && this.initAttempts < 10 && typeof WebGLRenderingContext !== 'undefined') {
      this.init();
    }
    this.boxCursor = 0;
    this.cylCursor = 0;
    this.sphereCursor = 0;
  }

  endPass(targetCtx) {
    const active = this.boxCursor + this.cylCursor + this.sphereCursor;
    this.lastMeshCount = active;
    if (!this.gl || !this.renderer || active === 0) return;
    for (let i = this.boxCursor; i < this.boxPool.length; i++) this.boxPool[i].visible = false;
    for (let i = this.cylCursor; i < this.cylPool.length; i++) this.cylPool[i].visible = false;
    for (let i = this.sphereCursor; i < this.spherePool.length; i++) this.spherePool[i].visible = false;
    this.renderer.render({ scene: this.scene, camera: this.camera, clear: true, frustumCull: false });
    this.drawCalls += active;
    this.totalFrames += 1;
    if (targetCtx && this.canvas) {
      targetCtx.drawImage(this.canvas, 0, 0, 720, 1280);
    }
  }

  screenToWorld(sx, sy, z = 0) {
    const dist = CAM_Z - z;
    const halfH = dist * TAN_HALF_FOV;
    const halfW = halfH * ASPECT;
    const pxUnit = (2 * halfH) / 1280;
    return {
      x: ((sx / 720) * 2 - 1) * halfW,
      y: (1 - (sy / 1280) * 2) * halfH,
      z,
      pxUnit,
    };
  }

  acquireMesh(pool, cursorProp, sx, sy, z, wPx, hPx, dPx, colorHex, rx = 0, ry = 0, rz = 0, flash = 0, emissive = 0, opacity = 1) {
    const idx = this[cursorProp]++;
    if (!this.gl || idx >= pool.length) return null;
    const mesh = pool[idx];
    const w = this.screenToWorld(sx, sy, z);
    mesh.visible = true;
    mesh.position.set(w.x, w.y, w.z);
    mesh.scale.set(Math.max(1, wPx) * w.pxUnit, Math.max(1, hPx) * w.pxUnit, Math.max(1, dPx) * w.pxUnit);
    mesh.rotation.set(rx, ry, rz);
    mesh.uColor.copy(this.parseColor(colorHex));
    mesh.uHitFlash = flash;
    mesh.uEmissive = emissive;
    mesh.uOpacity = opacity;
    return mesh;
  }

  addBox(sx, sy, z, wPx, hPx, dPx, colorHex, rx = 0, ry = 0, rz = 0, flash = 0, emissive = 0, opacity = 1) {
    return this.acquireMesh(this.boxPool, 'boxCursor', sx, sy, z, wPx, hPx, dPx, colorHex, rx, ry, rz, flash, emissive, opacity);
  }

  addCyl(sx, sy, z, diamPx, hPx, colorHex, rx = 0, ry = 0, rz = 0, flash = 0, emissive = 0, opacity = 1) {
    return this.acquireMesh(this.cylPool, 'cylCursor', sx, sy, z, diamPx, hPx, diamPx, colorHex, rx, ry, rz, flash, emissive, opacity);
  }

  addSphere(sx, sy, z, diamPx, colorHex, flash = 0, emissive = 0, opacity = 1) {
    return this.acquireMesh(this.spherePool, 'sphereCursor', sx, sy, z, diamPx, diamPx, diamPx, colorHex, 0, 0, 0, flash, emissive, opacity);
  }

  /**
   * Renders a compound 3D WebGL LEGO Brick (Box body + top Cylindrical LEGO Studs rotated rigidly in 3D space).
   */
  addLegoBrick(sx, sy, z, wPx, hPx, dPx, bodyColor, studColor = bodyColor, rx = 0.26, ry = -0.22, rz = 0, flash = 0, emissive = 0, studs = 2, opacity = 1) {
    this.addBox(sx, sy, z, wPx, hPx, dPx, bodyColor, rx, ry, rz, flash, emissive, opacity);
    if (studs <= 0) return;
    tmpEuler.set(rx, ry, rz);
    tmpQuat.fromEuler(tmpEuler);
    const studH = Math.max(4, hPx * 0.24);
    const studD = Math.min(wPx / Math.max(1.4, studs * 1.35), Math.max(6, dPx * 0.58));
    for (let i = 0; i < studs; i++) {
      const localX = studs === 1 ? 0 : ((i / (studs - 1)) - 0.5) * (wPx * 0.56);
      const localY = (hPx + studH) * 0.5;
      tmpOffset.set(localX, localY, 0).applyQuaternion(tmpQuat);
      this.addCyl(sx + tmpOffset.x, sy - tmpOffset.y, z, studD, studH, studColor, rx, ry, rz, flash, emissive + 0.06, opacity);
    }
  }

  /**
   * Mode 1: Sky Harbor Bridge Battle 3D WebGL Pass
   */
  renderBattle(view) {
    const c = view.art.c;
    const game = view.game;
    const t = view.reduced ? 0 : view.time;
    this.beginPass();

    // 1. 3D Bridge Guardrail Studs & Suspension Pylon Towers receding in 3D perspective
    const distance = game.state.distance;
    const towers = [10 - (distance % 36), 46 - (distance % 36)].filter(z => z > -2 && z < 70);
    for (const z of towers) {
      const l = view.project(-1.29, z), r = view.project(1.29, z), s = l.s;
      const h = 380 * s, w = 30 * s;
      for (const p of [l, r]) {
        this.addLegoBrick(p.x, p.y - h * 0.5, -2 - z * 0.08, w, h, w * 1.1, '#bd485c', '#ff9a82', 0.12, p.x < 360 ? 0.22 : -0.22, 0, 0, 0.05, 1);
      }
      this.addBox((l.x + r.x) * 0.5, l.y - h * 0.92, -2.1 - z * 0.08, (r.x - l.x) + w, 24 * s, 22 * s, '#f17c77', 0.14, 0, 0);
    }

    // 2. 3D Gates (LEGO Pillars & Crossbar)
    for (const gate of game.gates) {
      for (let i = 0; i < 2; i++) {
        const p = view.project(i === 0 ? -0.55 : 0.55, gate.z), s = p.s;
        if (s < 0.22) continue;
        const w = 250 * s, h = 195 * s;
        const blue = i === gate.blueSide;
        const col = blue ? '#279fdf' : '#e86b83', topCol = blue ? '#79e7ff' : '#ffadb3';
        this.addBox(p.x - w * 0.48, p.y - h * 0.5, -1 - gate.z * 0.06, 18 * s, h, 22 * s, col, 0.15, 0.25, 0, 0, 0.12);
        this.addBox(p.x + w * 0.48, p.y - h * 0.5, -1 - gate.z * 0.06, 18 * s, h, 22 * s, col, 0.15, -0.25, 0, 0, 0.12);
        this.addLegoBrick(p.x, p.y - h, -0.9 - gate.z * 0.06, w, 24 * s, 26 * s, col, topCol, 0.22, 0, 0, 0, 0.18, 3);
      }
    }

    // 3. 3D Enemies, Locks, Cargo Barrels, Supply Crates, and 3D Boss Crane Mech
    for (const e of game.entities) {
      const p = view.project(e.x, e.z), s = p.s;
      if (s < 0.18) continue;
      const flash = Math.min(1, (e.hitMs || 0) / 120);
      const hpRatio = (e.hp ?? 1) / Math.max(1, e.maxHp ?? 1);
      const zDepth = -e.z * 0.08;

      if (e.kind === 'enemy') {
        const gait = Math.sin(t / 110 + e.id) * 0.35;
        const wobble = flash * 0.25;
        // 3D Walking Legs
        this.addBox(p.x - 16 * s, p.y - 16 * s, zDepth, 15 * s, 28 * s, 18 * s, '#513757', 0.2 + gait, 0.18, 0, flash);
        this.addBox(p.x + 16 * s, p.y - 16 * s, zDepth, 15 * s, 28 * s, 18 * s, '#513757', 0.2 - gait, -0.18, 0, flash);
        // 3D Armored Torso Brick
        const bodyCol = hpRatio <= 0.5 ? '#c84b68' : '#da5f7c';
        this.addLegoBrick(p.x, p.y - 54 * s, zDepth + 0.2, 68 * s, 54 * s, 44 * s, bodyCol, '#ff98ae', 0.24 + wobble, Math.sin(t / 240 + e.id) * 0.22, 0, flash, 0.06, 0);
        // 3D Head / Popped Helmet
        if (hpRatio > 0.5) {
          this.addLegoBrick(p.x, p.y - 92 * s, zDepth + 0.3, 54 * s, 28 * s, 38 * s, '#8e3d59', '#ff8aa3', 0.26, Math.sin(t / 200 + e.id) * 0.25, 0, flash, 0.08, 2);
        } else {
          // Helmet popped off! Bare yellow 3D LEGO head + spinning stud
          this.addCyl(p.x, p.y - 90 * s, zDepth + 0.3, 38 * s, 24 * s, '#ffd86b', 0.28, t * 0.004, 0, flash, 0.18);
          this.addCyl(p.x, p.y - 106 * s, zDepth + 0.35, 22 * s, 12 * s, '#fff5b8', 0.28, -t * 0.006, 0, flash, 0.25);
        }
      } else if (e.kind === 'lock') {
        // 3D Rotating Hexagonal Lock Cylinder + Pop-off Corner Studs
        const activeBolts = Math.max(1, Math.ceil(hpRatio * 4));
        this.addCyl(p.x, p.y - 52 * s, zDepth + 0.2, 76 * s, 42 * s, '#d88b28', 0.48, t * 0.0022 + flash, 0.15, flash, 0.15);
        for (let b = 0; b < activeBolts; b++) {
          const ang = (b * Math.PI) / 2 + t * 0.002;
          this.addCyl(p.x + Math.cos(ang) * 32 * s, p.y - 52 * s + Math.sin(ang) * 20 * s, zDepth + 0.4, 18 * s, 16 * s, '#ffe79b', 0.45, ang, 0, flash, 0.25);
        }
      } else if (e.kind === 'crate' || e.kind === 'supply') {
        const col = e.kind === 'supply' ? '#49d6c8' : '#2f8fe8';
        this.addLegoBrick(p.x, p.y - 48 * s, zDepth + 0.2, 78 * s, 64 * s, 56 * s, col, '#b8fbff', 0.28, Math.sin(t / 280 + e.id) * 0.35, 0, flash, 0.15, 2);
      } else if (e.kind === 'boss') {
        // Massive 3D WebGL Boss Crane Mech aligned with crane(object) height!
        const tele = e.telegraph || 0;
        const bodyY = p.y - 182 * s;
        this.addLegoBrick(p.x, bodyY, zDepth + 0.4, 168 * s, 108 * s, 92 * s, hpRatio <= 0.35 ? '#9e3548' : '#d66844', '#ffd296', 0.26, Math.sin(t / 350) * 0.16, 0, flash, 0.08, hpRatio > 0.35 ? 3 : 1);
        // Glowing 3D Reactor Core Sphere in Boss Chest
        this.addSphere(p.x, bodyY + 12 * s, zDepth + 0.9, (38 + Math.sin(t / 90) * 5) * s, hpRatio <= 0.35 ? '#ff3b5c' : '#7effe8', flash, 0.45);
        // Detachable 3D Shoulder Armor Pods (pop off below 65% HP)
        if (hpRatio > 0.65) {
          for (const side of [-1, 1]) {
            this.addLegoBrick(p.x + side * 102 * s, bodyY - 18 * s, zDepth + 0.5, 42 * s, 50 * s, 48 * s, '#e08a45', '#ffe7a8', 0.25, side * 0.3, 0, flash, 0.1, 1);
          }
        }
        // Articulated 3D Left & Right Claw Arms (rear back on telegraph)
        for (const side of [-1, 1]) {
          const clawLift = tele > 0 ? 48 * s * Math.sin(tele * Math.PI) : Math.sin(t / 180 + side) * 12 * s;
          const armX = p.x + side * 116 * s, armY = bodyY + 46 * s - clawLift;
          this.addBox(armX, armY, zDepth + 0.7, 28 * s, 76 * s, 32 * s, '#63768d', 0.35 + tele * 0.6, side * 0.25, side * 0.2, flash);
          this.addCyl(armX + side * 10 * s, armY + 42 * s, zDepth + 0.8, 34 * s, 24 * s, '#ffd86b', 0.4, t * 0.003 * side, 0, flash, 0.18);
        }
      } else {
        // Cargo Barrel / Armor Barrel
        const col = e.cargo ? '#e08b3e' : '#c95972';
        this.addCyl(p.x, p.y - 46 * s, zDepth + 0.2, 68 * s, 68 * s, col, 0.28, t * 0.002 + e.id, 0, flash, 0.1);
        if (hpRatio > 0.5) {
          this.addCyl(p.x, p.y - 84 * s, zDepth + 0.25, 36 * s, 14 * s, '#ffe596', 0.28, -t * 0.002, 0, flash, 0.18);
        }
      }
    }

    // 4. 3D Energy Projectiles (Bullets)
    for (const b of game.bullets) {
      const p = view.project(b.x, b.z, 56), s = p.s;
      const wColor = b.powered ? '#61ffe6' : '#ffb43e';
      this.addSphere(p.x, p.y, -b.z * 0.08 + 0.6, (b.powered ? 24 : 18) * s, wColor, 0, 0.75);
      this.addCyl(p.x, p.y + 14 * s, -b.z * 0.08 + 0.5, 11 * s, 28 * s, '#ffffff', 0.4, 0, 0, 0, 0.85);
    }

    // 5. 3D Tumbling Battle Debris Bricks
    for (const d of view.debris) {
      if (d.life <= 0) continue;
      this.addLegoBrick(d.x, d.y, 1.2, d.size * 1.15, d.size * 0.8, d.size * 0.8, d.color || '#ffd86b', '#fff5c0', d.angle, d.angle * 1.3, d.angle * 0.7, 0, 0.2, 1);
    }

    this.endPass(c);
  }

  /**
   * Mode 2: Cloud Lighthouse 50F Stairs 3D WebGL Pass
   */
  renderStairs(view) {
    const c = view.ctx;
    const state = view.game.state;
    const t = view.reducedMotion ? 0 : view.time;
    this.beginPass();

    // 1. Giant 3D Cylindrical LEGO Cloud Lighthouse Spire in center background
    const towerShift = (-view.cameraY * 0.18) % 240;
    for (let i = 0; i < 4; i++) {
      const ty = 260 + i * 220 + towerShift;
      if (ty < 120 || ty > 1020) continue;
      const col = i % 2 === 0 ? '#d8e6f5' : '#e0675a';
      this.addCyl(360, ty, -5.5, 148, 175, col, 0.14, t * 0.0004, 0, 0, 0.05, 0.42);
      this.addCyl(360, ty - 88, -5.2, 168, 22, '#ffd86b', 0.16, -t * 0.0008, 0, 0, 0.15, 0.5);
    }

    // 2. 3D WebGL LEGO Staircase Blocks + Cylindrical Top Studs + Spinning 3D Golden Star Bricks on stomped steps
    for (let i = view.game.steps.length - 1; i >= 0; i--) {
      const step = view.game.steps[i];
      const tile = (view.tiles.get(step.id)?.value ?? 0) * (view.reducedMotion ? 0.25 : 1);
      const sy = view.screenY(step.y) + tile;
      if (sy < 110 || sy > 1040) continue;
      const stomped = step.id <= state.step;
      const current = step.id === state.step;
      const bodyCol = stomped ? '#e8a838' : current ? '#49dfd0' : '#39b8b6';
      const studCol = stomped ? '#fff5b8' : '#b8fff6';
      const ry = (step.id % 2 ? 1 : -1) * -0.22 + (stomped ? Math.sin(t / 300 + step.id) * 0.08 : 0);
      this.addLegoBrick(step.x, sy + 18, -1.2, 126, 36, 74, bodyCol, studCol, 0.34, ry, 0, current ? 0.25 : 0, stomped ? 0.26 : 0.08, 3);
      if (stomped && !current) {
        // Spinning 3D Golden Star Crystal above stomped steps
        this.addBox(step.x, sy - 14, -0.6, 20, 20, 20, '#ffe875', t * 0.003 + step.id, t * 0.004, 0.78, 0, 0.45);
      }
    }

    // 3. 3D Burst Particles on step landing
    for (const p of view.particles) {
      if (p.life <= 0) continue;
      const py = view.screenY(p.y);
      if (py < 120 || py > 1020) continue;
      this.addCyl(p.x, py, 0.8, p.size * 1.4, p.size * 0.9, p.color || '#ffe875', p.rotation, p.rotation * 1.4, 0, 0, 0.25);
    }

    this.endPass(c);
  }

  /**
   * Mode 3: Runaway Starlight Coach Runner 3D WebGL Pass
   */
  renderRunner(view, wagonX, hitReaction) {
    const c = view.art.c;
    const s = view.runner.state;
    const t = view.reduced ? 0 : view.time;
    const d = s.distance;
    this.beginPass();

    // 1. 3D Railway Track Studs scrolling underfoot
    for (let i = 0; i < 8; i++) {
      const x = i * 112 - (d % 112) + 32;
      if (x < -40 || x > 760) continue;
      this.addCyl(x, 876, -1.5, 24, 12, s.goldMs ? '#ffd86b' : '#57b982', 0.35, t * 0.002, 0, 0, s.goldMs ? 0.3 : 0.08);
    }

    // 2. 3D Runaway Starlight Train Coach with 3D Spinning Wheels & Progressive 3D Booster Assembly!
    const wy = 832 - hitReaction * 8;
    const flash = Math.min(1, hitReaction * 1.2);
    // 3D Coach Chassis & Roof
    this.addLegoBrick(wagonX, wy, 0.2, 114, 58, 68, s.goldMs ? '#f5b935' : '#3a7ca5', s.goldMs ? '#fff5b8' : '#8ee2ff', 0.22, -0.24 + hitReaction * 0.2, 0, flash, s.goldMs ? 0.28 : 0.1, 3);
    // 3D Spinning Train Wheels
    for (const dx of [-34, 34]) {
      this.addCyl(wagonX + dx, 864, 0.6, 26, 14, '#d98a3c', 1.4, 0, t * 0.015, flash, 0.15);
    }
    // Stage 1: 3D Golden Magnetic Front Bumper
    if (s.slot >= 1 || s.goldMs) {
      this.addLegoBrick(wagonX - 64, wy + 8, 0.5, 26, 26, 36, '#ffd363', '#fff5bd', 0.24, -0.3, 0, flash, 0.28, 1);
    }
    // Stage 2: Twin 3D Angled Golden Booster Wings
    if (s.slot >= 2 || s.goldMs) {
      this.addBox(wagonX - 24, wy - 28, 0.7, 46, 16, 32, '#ffd86b', 0.45, -0.35, 0.42, flash, 0.32);
      this.addBox(wagonX + 24, wy - 28, 0.7, 46, 16, 32, '#ffd86b', 0.45, 0.35, -0.42, flash, 0.32);
    }
    // Stage 3: 3D Glowing Turbo Jet Thruster Cones
    if (s.goldMs) {
      this.addCyl(wagonX + 68, wy + 2, 0.6, 28, 44, '#63ffee', 0.2, 0, Math.PI * 0.5, 0, 0.85);
      this.addSphere(wagonX + 92 + Math.sin(t / 40) * 8, wy + 2, 0.7, 26, '#fff8c4', 0, 0.95);
    }

    // 3. 3D Rotating Hover Power Crates & 3D Patrol Mech Crawlers
    for (const item of view.runner.items.active) {
      if (item.kind === 'word') {
        const bob = view.reduced ? 0 : Math.sin(t / 140 + item.x * 0.02) * 6;
        const iy = item.y + bob + 22;
        this.addLegoBrick(item.x, iy, -0.2, 136, 68, 56, '#f5b935', '#fff5b8', 0.26 + Math.sin(t / 220) * 0.08, Math.cos(t / 260 + item.x * 0.01) * 0.22, 0, 0, 0.18, 3);
        this.addCyl(item.x - 74, iy, 0.1, 22, 16, '#7effe8', 0.35, t * 0.005, 0, 0, 0.55);
        this.addCyl(item.x + 74, iy, 0.1, 22, 16, '#7effe8', 0.35, -t * 0.005, 0, 0, 0.55);
      } else if (item.kind === 'coin') {
        const cy = item.y + Math.sin(t / 180 + item.x) * 5;
        this.addCyl(item.x, cy, 0.2, 32, 10, '#ffe16a', 1.35, t * 0.004 + item.x, 0, 0, 0.32);
      } else {
        // 3D Patrol Mech Crawler with Yellow 3D Stomp Pad
        const walk = view.reduced ? 0 : Math.sin(t / 75 + item.x * 0.05) * 0.35;
        this.addBox(item.x - 18, 860, 0.1, 14, 18, 18, '#3a2846', 0.2 + walk, 0.2, 0);
        this.addBox(item.x + 18, 860, 0.1, 14, 18, 18, '#3a2846', 0.2 - walk, -0.2, 0);
        this.addLegoBrick(item.x, 836, 0.3, 62, 46, 44, '#c84b68', '#ff9eb2', 0.24, -0.22 + Math.sin(t / 160) * 0.12, 0, 0, 0.1, 0);
        this.addCyl(item.x, 806, 0.4, 34, 14, '#ffe875', 0.28, t * 0.004, 0, 0, 0.35);
      }
    }

    // 4. 3D Spent Steel Blocks, 3D Ejected Star Core Powerups & 3D Flattened Tumbling Mechs
    for (const b of view.spentBlocks) {
      if (b.life <= 0) continue;
      this.addLegoBrick(b.x, b.y + b.bumpY + 24, -0.1, 154, 58, 48, b.good ? '#56738f' : '#6e536b', '#9ebbd4', 0.24, -0.18, 0, 0, 0.08, 2);
    }
    for (const u of view.powerups) {
      if (u.life <= 0) continue;
      this.addSphere(u.x, u.y, 1.0, 28, '#ffe875', 0, 0.75);
      this.addBox(u.x, u.y, 1.1, 22, 22, 22, '#7effe8', t * 0.008, t * 0.006, 0.78, 0, 0.65);
    }
    for (const m of view.crushedMechs) {
      if (m.life <= 0) continue;
      this.addLegoBrick(m.x, m.y, 0.9, m.stomp ? 74 : 58, m.stomp ? 22 : 40, 44, '#8f3850', '#ffaec0', m.angle, m.angle * 1.2, m.angle * 0.8, 0.3, 0.12, 1);
    }

    this.endPass(c);
  }

  /**
   * Mode 4: Engine Workshop Plaza 3D WebGL Pass
   */
  renderPlaza(view, dock, collectedTotal) {
    const c = view.art.c;
    const s = view.plaza.state;
    const t = view.reduced ? 0 : view.time;
    this.beginPass();

    // 1. 3D Corner LEGO Beacon Pillars around the isometric arena
    for (const [cx, cz] of [[-3.8, -3.8], [3.8, -3.8], [3.8, 3.8], [-3.8, 3.8]]) {
      const cp = view.iso(cx, cz);
      this.addLegoBrick(cp.x, cp.y - 22, -1.8, 30, 42, 30, '#3b6990', '#8ee2ff', 0.38, 0.68, 0, 0, 0.14, 1);
      this.addSphere(cp.x, cp.y - 50, -1.5, 16, '#ffe875', 0, 0.55);
    }

    // 2. 3D Starlight Express Locomotive at the Dock + Progressive 3D Glowing Engine Core Modules!
    const flash = Math.min(1, view.dockPulseMs / 240);
    this.addLegoBrick(dock.x - 16, dock.y - 26, -0.4, 78, 42, 48, '#356d96', '#89dcff', 0.32, 0.58, 0, flash, 0.14, 2);
    this.addCyl(dock.x + 18, dock.y - 24, -0.2, 34, 52, '#d95b5b', 0.35, 0.58, Math.PI * 0.48, flash, 0.16);
    this.addCyl(dock.x + 28, dock.y - 50, 0.1, 16, 22, '#ffd86b', 0.32, t * 0.003, 0, flash, 0.28);
    for (let i = 0; i < Math.min(3, collectedTotal); i++) {
      const col = ['#ff6c83', '#77ceff', '#74efd0'][i];
      this.addLegoBrick(dock.x - 22 + i * 20, dock.y - 38, 0.4, 18, 18, 18, col, '#fff8d6', 0.35, t * 0.004 + i, 0, flash, 0.55, 1);
    }

    // 3. 3D Isometric Workbenches & 3D Rotating Engine Parts (or Activated Green 3D Sockets!)
    for (const item of view.plaza.items.active) {
      const p = view.iso(item.x, item.z);
      const col = item.collected ? '#2d7a6e' : '#70659e';
      const topCol = item.collected ? '#7effe0' : '#cfc5f5';
      this.addLegoBrick(p.x, p.y - 10, -0.6, 56, 24, 46, col, topCol, 0.42, 0.68, 0, 0, item.collected ? 0.28 : 0.08, 2);
      if (item.collected) {
        this.addCyl(p.x, p.y - 28, 0.1, 24, 14, '#7effe8', 0.42, t * 0.004, 0, 0, 0.65);
      } else {
        const hover = view.reduced ? 0 : Math.sin(t / 200 + item.x) * 5;
        const py = p.y - 36 + hover;
        const rotY = t * 0.0032 + item.x;
        const partColors = { key: '#ff6c83', star: '#77ceff', gem: '#74efd0', book: '#b494f3', console: '#f3b05a', bomb: '#7b8db8' };
        const pCol = partColors[item.kind] || '#ffe875';
        if (item.kind === 'star' || item.kind === 'gem') {
          this.addBox(p.x, py, 0.3, 28, 28, 28, pCol, 0.65, rotY, 0.78, 0, 0.42);
        } else if (item.kind === 'key' || item.kind === 'bomb') {
          this.addCyl(p.x, py, 0.3, 28, 18, pCol, 0.55, rotY, 0.35, 0, 0.38);
        } else {
          this.addLegoBrick(p.x, py, 0.3, 34, 24, 24, pCol, '#fff8d6', 0.45, rotY, 0, 0, 0.32, 1);
        }
      }
    }

    // 4. 3D Patrol Guard Robots in Plaza
    for (const h of view.plaza.hazards.active) {
      const p = view.iso(h.x, h.z);
      this.addLegoBrick(p.x, p.y - 44, -0.1, 54, 44, 42, '#7c8ecb', '#b5d7ff', 0.32, Math.sin(t / 220) * 0.35, 0, 0, 0.12, 1);
      this.addLegoBrick(p.x, p.y - 88, 0.2, 58, 38, 40, '#9fcbea', '#e6ffff', 0.32, Math.cos(t / 180) * 0.45, 0, 0, 0.18, 1);
    }

    // 5. 3D Flying Cargo Part arcing to the Locomotive Dock
    for (const f of view.flyingCargo) {
      if (f.life <= 0) continue;
      const prog = 1 - f.life / f.duration;
      const fx = f.sx + (f.tx - f.sx) * prog;
      const fy = f.sy + (f.ty - f.sy) * prog - Math.sin(prog * Math.PI) * 145;
      this.addLegoBrick(fx, fy, 1.4, 30, 22, 22, '#ffe875', '#7effe8', prog * 9, prog * 12, prog * 6, 0.3, 0.65, 1);
    }

    this.endPass(c);
  }

  /**
   * Lobby 3D WebGL Pass: 3D Rotating LEGO Starlight Express Showcase & 3D Cartridge Emblems
   */
  renderLobby(view, cards) {
    const c = view.art.c;
    const t = view.motion?.matches ? 0 : view.time;
    this.beginPass();

    for (const card of cards) {
      const cx = card.x + 152, cy = card.y + 154;
      const rot = t * 0.0022 + card.x * 0.01;
      if (card.id === 'stairs') {
        this.addLegoBrick(cx - 22, cy + 18, -0.5, 52, 22, 36, '#42d2bc', '#b8ffe5', 0.35, rot, 0, 0, 0.2, 2);
        this.addLegoBrick(cx + 18, cy - 10, -0.2, 52, 22, 36, '#ffd86b', '#fff6c0', 0.35, rot, 0, 0, 0.28, 2);
      } else if (card.id === 'battle') {
        this.addLegoBrick(cx, cy - 14, -0.3, 64, 44, 44, '#d4734a', '#ffd89c', 0.32, rot, 0, 0, 0.22, 2);
      } else if (card.id === 'runner') {
        this.addLegoBrick(cx + 12, cy - 18, -0.3, 56, 38, 40, '#f5b935', '#fff5b8', 0.32, rot, 0, 0, 0.25, 2);
      } else {
        this.addBox(cx, cy - 6, -0.3, 42, 42, 42, '#b199f3', 0.65, rot, 0.78, 0, 0.3);
      }
    }

    this.endPass(c);
  }

  /**
   * Juice 3D Rigid-Body LEGO Fracture Physics Pass
   */
  renderJuice(juice) {
    const c = juice.art.c;
    this.beginPass();
    for (const b of juice.physics.bodies) {
      if (b.life <= 0) continue;
      const opacity = Math.min(1, b.life / 180);
      if (b.kind === 'stud') {
        this.addCyl(b.x, b.y, 2.2, b.w * 1.25, b.h * 1.15, b.front, b.angle * 1.4, b.angle * 1.8, b.angle * 0.9, 0, 0.28, opacity);
      } else {
        this.addLegoBrick(b.x, b.y, 2.0, b.w * 1.25, b.h * 1.2, b.w * 0.85, b.front, b.top, b.angle * 1.2, b.angle * 1.6, b.angle * 0.8, 0, 0.22, 2, opacity);
      }
    }
    this.endPass(c);
  }

  stats() {
    return {
      engine: 'OGL-1.0.11',
      webglActive: Boolean(this.gl),
      webglVersion: this.renderer?.isWebgl2 ? 2 : this.gl ? 1 : 0,
      drawCalls: this.drawCalls,
      lastMeshCount: this.lastMeshCount,
      totalFrames: this.totalFrames,
      poolSize: this.boxPool.length + this.cylPool.length + this.spherePool.length,
      initError: this.initError || null,
    };
  }
}

export const webglStage = new OGLStage();
