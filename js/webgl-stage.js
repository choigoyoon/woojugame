// Full-Screen Open-Source OGL v1.0.11 WebGL2 3D Voxel & Mecha Graphics Engine.
// Renders 100% of the 3D game world: 3D perspective camera, 3D terrain/ocean/bridge/rails/arena,
// 3D contact shadows, 14-part 3D articulated Star-Ranger Mecha, 3D Spider-Drones, 24-part 3D Dreadnought Boss,
// 3D Aerodynamic Galaxy-Liner Bullet Train, 3D plasma projectiles, and 3D rigid-body voxel explosions.
import { Renderer, Camera, Transform, Program, Mesh, Box, Cylinder, Sphere, Color, Vec3, Mat4, Quat, Euler } from './ogl.js';

const VERTEX_SHADER = `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vLocalPos;
varying vec3 vWorldPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vLocalPos = position;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
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
varying vec3 vWorldPos;
uniform vec3 uColor;
uniform float uEmissive;
uniform float uHitFlash;
uniform float uOpacity;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPos);
  // Dual studio directional lights (warm sun key + cool cyan rim fill)
  vec3 L1 = normalize(vec3(-0.48, 0.82, 0.56));
  vec3 L2 = normalize(vec3(0.62, -0.25, -0.45));
  float diff1 = max(dot(N, L1), 0.0);
  float diff2 = max(dot(N, L2), 0.0) * 0.32;
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = mix(vec3(0.11, 0.16, 0.30), vec3(0.90, 0.96, 1.0), hemi) * 0.46;
  vec3 H = normalize(L1 + V);
  float spec = pow(max(dot(N, H), 0.0), 40.0) * 0.76;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6) * 0.38;
  // 3D Voxel edge bevel highlight & dark cavity contour
  vec3 edgeDist = abs(vLocalPos) * 2.0;
  float maxEdge = max(max(edgeDist.x, edgeDist.y), edgeDist.z);
  float midEdge = min(max(edgeDist.x, edgeDist.y), max(min(edgeDist.x, edgeDist.y), edgeDist.z));
  float cornerEdge = smoothstep(0.86, 0.99, maxEdge * midEdge);
  vec3 col = uColor * (ambient + diff1 * 0.92 + diff2)
    + vec3(1.0, 0.98, 0.92) * (spec + cornerEdge * 0.20)
    + mix(uColor, vec3(0.45, 0.96, 1.0), 0.55) * rim
    + uColor * (uEmissive * 0.58);
  // Crisp cel-style outer edge darkening on grazing angles
  float outline = smoothstep(0.08, 0.24, max(dot(N, V), 0.0));
  col = mix(vec3(0.04, 0.07, 0.16), col, mix(0.55, 1.0, outline));
  col = mix(col, vec3(1.0, 0.97, 0.86), clamp(uHitFlash * 0.42, 0.0, 0.42));
  gl_FragColor = vec4(col, uOpacity);
}
`;

const tmpVec = new Vec3();
const tmpTarget = new Vec3();
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
    this.initError = null;
    this.colorCache = new Map();
    // Plaza 3D auto-fire brawl state (visual bolts & muzzle flash)
    this.brawlBolts = Array.from({ length: 12 }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0 }));
    this.brawlBoltCursor = 0;
    this.lastBrawlShot = 0;
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
        fov: 42,
        aspect: 720 / 1280,
        near: 0.5,
        far: 140,
      });
      this.camera.position.set(0, 12, 20);
      this.camera.lookAt([0, 2, 0]);

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

      this.allocatePool(this.boxPool, this.boxGeo, 360);
      this.allocatePool(this.cylPool, this.cylGeo, 320);
      this.allocatePool(this.spherePool, this.sphereGeo, 96);
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

  setCamera(cx, cy, cz, tx, ty, tz) {
    if (!this.camera) return;
    this.camera.position.set(cx, cy, cz);
    tmpTarget.set(tx, ty, tz);
    this.camera.lookAt(tmpTarget);
    this.camera.updateMatrixWorld();
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

  // Compatibility screenToWorld mapping (at default camera pose) + true 3D worldToScreen projection
  screenToWorld(sx, sy, z = 0) {
    const dist = 20 - z;
    const halfH = dist * Math.tan((35 * Math.PI) / 360);
    const halfW = halfH * (720 / 1280);
    const pxUnit = (2 * halfH) / 1280;
    return {
      x: ((sx / 720) * 2 - 1) * halfW,
      y: (1 - (sy / 1280) * 2) * halfH,
      z,
      pxUnit,
    };
  }

  worldToScreen(wx, wy, wz) {
    if (!this.camera) return { x: 360, y: 640, s: 1, visible: true };
    tmpVec.set(wx, wy, wz);
    tmpVec.applyMatrix4(this.camera.viewMatrix);
    const viewZ = -tmpVec.z;
    if (viewZ < 0.3) return { x: 360, y: -200, s: 0.1, visible: false };
    tmpVec.applyMatrix4(this.camera.projectionMatrix);
    return {
      x: (tmpVec.x * 0.5 + 0.5) * 720,
      y: (1 - (tmpVec.y * 0.5 + 0.5)) * 1280,
      s: Math.min(2.5, 16 / viewZ),
      visible: tmpVec.z <= 1.05,
    };
  }

  // Raw 3D World Space Mesh placement (in true 3D coordinates wx, wy, wz!)
  wBox(wx, wy, wz, sx, sy, sz, colorHex, rx = 0, ry = 0, rz = 0, flash = 0, emissive = 0, opacity = 1) {
    const idx = this.boxCursor++;
    if (!this.gl || idx >= this.boxPool.length) return null;
    const m = this.boxPool[idx];
    m.visible = true;
    m.position.set(wx, wy, wz);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    m.uColor.copy(this.parseColor(colorHex));
    m.uHitFlash = flash;
    m.uEmissive = emissive;
    m.uOpacity = opacity;
    return m;
  }

  wCyl(wx, wy, wz, diam, h, colorHex, rx = 0, ry = 0, rz = 0, flash = 0, emissive = 0, opacity = 1) {
    const idx = this.cylCursor++;
    if (!this.gl || idx >= this.cylPool.length) return null;
    const m = this.cylPool[idx];
    m.visible = true;
    m.position.set(wx, wy, wz);
    m.scale.set(diam, h, diam);
    m.rotation.set(rx, ry, rz);
    m.uColor.copy(this.parseColor(colorHex));
    m.uHitFlash = flash;
    m.uEmissive = emissive;
    m.uOpacity = opacity;
    return m;
  }

  wSphere(wx, wy, wz, diam, colorHex, flash = 0, emissive = 0, opacity = 1) {
    const idx = this.sphereCursor++;
    if (!this.gl || idx >= this.spherePool.length) return null;
    const m = this.spherePool[idx];
    m.visible = true;
    m.position.set(wx, wy, wz);
    m.scale.set(diam, diam, diam);
    m.rotation.set(0, 0, 0);
    m.uColor.copy(this.parseColor(colorHex));
    m.uHitFlash = flash;
    m.uEmissive = emissive;
    m.uOpacity = opacity;
    return m;
  }

  wShadow(wx, wy, wz, radiusX, radiusZ = radiusX) {
    const idx = this.cylCursor++;
    if (!this.gl || idx >= this.cylPool.length) return null;
    const m = this.cylPool[idx];
    m.visible = true;
    m.position.set(wx, wy + 0.03, wz);
    m.scale.set(radiusX * 2, 0.04, radiusZ * 2);
    m.rotation.set(0, 0, 0);
    m.uColor.copy(this.parseColor('#050c1a'));
    m.uHitFlash = 0;
    m.uEmissive = 0;
    m.uOpacity = 0.45;
    return m;
  }

  wLegoBlock(wx, wy, wz, sx, sy, sz, bodyCol, studCol = bodyCol, rx = 0, ry = 0, rz = 0, flash = 0, emissive = 0, studsX = 2, studsZ = 1) {
    this.wBox(wx, wy, wz, sx, sy, sz, bodyCol, rx, ry, rz, flash, emissive, 1);
    if (studsX <= 0) return;
    tmpEuler.set(rx, ry, rz);
    tmpQuat.fromEuler(tmpEuler);
    const sh = Math.max(0.14, sy * 0.22);
    const sd = Math.min(sx / Math.max(1.5, studsX * 1.4), sz / Math.max(1.4, studsZ * 1.4), 0.65);
    for (let ix = 0; ix < studsX; ix++) {
      for (let iz = 0; iz < studsZ; iz++) {
        const lx = studsX === 1 ? 0 : ((ix / (studsX - 1)) - 0.5) * (sx * 0.58);
        const lz = studsZ === 1 ? 0 : ((iz / (studsZ - 1)) - 0.5) * (sz * 0.55);
        const ly = (sy + sh) * 0.5;
        tmpOffset.set(lx, ly, lz).applyQuaternion(tmpQuat);
        this.wCyl(wx + tmpOffset.x, wy + tmpOffset.y, wz + tmpOffset.z, sd, sh, studCol, rx, ry, rz, flash, emissive + 0.08, 1);
      }
    }
  }

  // Screen-space compatibility helper (used by unit test & juice particles)
  addLegoBrick(sx, sy, z, wPx, hPx, dPx, bodyColor, studColor = bodyColor, rx = 0.26, ry = -0.22, rz = 0, flash = 0, emissive = 0, studs = 2, opacity = 1) {
    const w = this.screenToWorld(sx, sy, z);
    this.wBox(w.x, w.y, w.z, wPx * w.pxUnit, hPx * w.pxUnit, dPx * w.pxUnit, bodyColor, rx, ry, rz, flash, emissive, opacity);
    for (let i = 0; i < studs; i++) {
      const lx = studs === 1 ? 0 : ((i / (studs - 1)) - 0.5) * (wPx * 0.5) * w.pxUnit;
      this.wCyl(w.x + lx, w.y + (hPx * 0.6) * w.pxUnit, w.z, (dPx * 0.45) * w.pxUnit, (hPx * 0.25) * w.pxUnit, studColor, rx, ry, rz, flash, emissive, opacity);
    }
  }

  /**
   * 14-Part 3D Articulated Star-Ranger Astro-Mecha Hero!
   * Fully rendered in 3D WebGL2 with animated 3D limbs, 3D visor, 3D V-fin crown, 3D plasma rifle, and 3D jetpack!
   */
  addMechaHero3D(wx, wy, wz, scale = 1, { time = 0, yaw = 0, run = false, jump = 0, gold = false, palette = {}, crown = true, rifle = false, flash = 0 } = {}) {
    const s = scale;
    const suit = gold ? '#ffbe0b' : (palette.shirt || '#ff5e4d');
    const helmet = gold ? '#ffd166' : (palette.helmet || '#00d2ff');
    const stride = run ? Math.sin(time / 85) : 0;
    const bob = run ? Math.abs(stride) * 0.16 * s : Math.sin(time / 320) * 0.07 * s;
    const y0 = wy + bob;

    const rotOffset = (lx, ly, lz) => {
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      return [wx + (lx * cos + lz * sin) * s, y0 + ly * s, wz + (-lx * sin + lz * cos) * s];
    };

    // 1. 3D Articulated Legs & Thruster Boots
    for (const side of [-1, 1]) {
      const legSwing = run ? stride * side * 0.65 : 0;
      const legZ = Math.sin(legSwing) * 0.35;
      const legY = 0.42 + Math.abs(Math.sin(legSwing)) * 0.15;
      const [lx, ly, lz] = rotOffset(side * 0.34, legY, legZ);
      this.wBox(lx, ly, lz, 0.34 * s, 0.52 * s, 0.42 * s, '#1d2d50', legSwing, yaw, 0, flash, 0.05);
      const [bx, by, bz] = rotOffset(side * 0.34, legY - 0.28, legZ + 0.06);
      this.wBox(bx, by, bz, 0.42 * s, 0.28 * s, 0.56 * s, '#f8f9fa', legSwing * 0.5, yaw, 0, flash, 0.12);
      this.wCyl(bx, by - 0.14 * s, bz, 0.32 * s, 0.12 * s, gold ? '#ffbe0b' : '#00f5d4', 0, yaw, 0, flash, 0.75);
    }

    // 2. 3D Armored Mech Torso & Glowing Starlight Chest Core
    const [tx, ty, tz] = rotOffset(0, 1.08, 0);
    this.wBox(tx, ty, tz, 0.96 * s, 0.88 * s, 0.66 * s, suit, 0, yaw, 0, flash, gold ? 0.28 : 0.1);
    const [cx, cy, cz] = rotOffset(0, 1.12, 0.34);
    this.wSphere(cx, cy, cz, 0.38 * s, gold ? '#ffbe0b' : '#00f5d4', flash, 0.85);
    // Twin 3D Jetpack Thrusters on Back
    for (const side of [-1, 1]) {
      const [jx, jy, jz] = rotOffset(side * 0.26, 1.12, -0.42);
      this.wCyl(jx, jy, jz, 0.28 * s, 0.62 * s, '#1b3b6f', 0.15, yaw, 0, flash, 0.15);
      if (run || jump > 0 || gold) {
        const [fx, fy, fz] = rotOffset(side * 0.26, 0.68, -0.48);
        this.wCyl(fx, fy, fz, 0.22 * s, (0.38 + Math.sin(time / 35) * 0.12) * s, gold ? '#ffbe0b' : '#00f5d4', 0.25, yaw, 0, 0, 0.95);
      }
    }

    // 3. 3D Shoulder Pauldrons, Power Gauntlets & Optional 3D Plasma Rifle
    for (const side of [-1, 1]) {
      const armSwing = rifle && side > 0 ? -0.65 : (run ? -stride * side * 0.55 : Math.sin(time / 280) * 0.1 * side);
      const [ax, ay, az] = rotOffset(side * 0.68, 1.14, -Math.sin(armSwing) * 0.28);
      this.wBox(ax, ay + 0.16 * s, az, 0.38 * s, 0.34 * s, 0.44 * s, helmet, 0, yaw, side * -0.18, flash, 0.18);
      this.wBox(ax, ay - 0.14 * s, az, 0.32 * s, 0.48 * s, 0.36 * s, suit, armSwing, yaw, 0, flash, 0.1);
      if (rifle && side > 0) {
        const [rx, ry, rz] = rotOffset(side * 0.68, 1.05, 0.55);
        this.wCyl(rx, ry, rz, 0.24 * s, 0.95 * s, '#00f5d4', Math.PI * 0.5, yaw, 0, 0, 0.75);
      }
    }

    // 4. 3D Contoured Space-Dome Helmet, Dark-Sapphire Visor, Glowing LED Eyes & V-Fin Crown!
    const [hx, hy, hz] = rotOffset(0, 1.92, 0);
    this.wBox(hx, hy, hz, 1.18 * s, 0.92 * s, 1.02 * s, '#f8f9fa', 0, yaw, 0, flash, 0.15);
    this.wBox(hx, hy + 0.26 * s, hz, 1.12 * s, 0.42 * s, 0.98 * s, helmet, 0, yaw, 0, flash, 0.22);
    // Side Wing-Fin Antennas
    for (const side of [-1, 1]) {
      const [wx2, wy2, wz2] = rotOffset(side * 0.68, 2.02, 0);
      this.wBox(wx2, wy2, wz2, 0.16 * s, 0.54 * s, 0.38 * s, '#00f5d4', -0.2, yaw, side * -0.22, flash, 0.55);
    }
    // Front Visor & Glowing 3D LED Eyes
    const [vx, vy, vz] = rotOffset(0, 1.88, 0.48);
    this.wBox(vx, vy, vz, 0.92 * s, 0.48 * s, 0.16 * s, '#081226', 0, yaw, 0, 0, 0.05);
    for (const side of [-1, 1]) {
      const [ex, ey, ez] = rotOffset(side * 0.24, 1.90, 0.56);
      this.wSphere(ex, ey, ez, 0.18 * s, gold ? '#ffbe0b' : '#00f5d4', 0, 0.95);
    }
    // Golden V-Fin Star Crown Diadem
    if (crown) {
      const [kx, ky, kz] = rotOffset(0, 2.52, 0.12);
      this.wBox(kx, ky, kz, 0.76 * s, 0.36 * s, 0.24 * s, '#ffbe0b', 0.1, yaw, 0, flash, 0.55);
      for (const side of [-1, 1]) {
        const [fx, fy, fz] = rotOffset(side * 0.42, 2.62, 0.12);
        this.wBox(fx, fy, fz, 0.22 * s, 0.48 * s, 0.20 * s, '#ffd166', 0.1, yaw, side * -0.45, flash, 0.6);
      }
    }
  }

  /**
   * 3D Spider-Walker Pirate Drone (4 3D spider legs, obsidian dome, glowing red Cyclops laser eye, shatterable armor!)
   */
  addSpiderDrone3D(wx, wy, wz, scale = 1, { time = 0, id = 0, hpRatio = 1, flash = 0 } = {}) {
    const s = scale;
    const damaged = hpRatio <= 0.55;
    const walk = Math.sin(time / 85 + id) * 0.38;
    this.wShadow(wx, wy, wz, 1.15 * s, 0.95 * s);
    // 4 Articulated 3D Spider Legs
    for (const side of [-1, 1]) {
      for (const fb of [-1, 1]) {
        const lift = Math.max(0, Math.sin(time / 85 + id + side * fb)) * 0.25;
        this.wBox(wx + side * 0.85 * s, wy + (0.45 + lift) * s, wz + fb * 0.45 * s, 0.65 * s, 0.22 * s, 0.22 * s, '#1f1633', 0, fb * 0.35, side * -0.45, flash, 0.1);
        this.wBox(wx + side * 1.15 * s, wy + (0.25 + lift) * s, wz + fb * 0.55 * s, 0.22 * s, 0.52 * s, 0.22 * s, '#ff2a6d', 0, 0, side * 0.2, flash, 0.3);
      }
    }
    // Main Obsidian Armored Core Pod
    this.wSphere(wx, wy + 0.85 * s, wz, 1.35 * s, '#23193d', flash, 0.12);
    if (!damaged) {
      // Crimson Upper Shell & Twin Golden Horns
      this.wLegoBlock(wx, wy + 1.25 * s, wz, 1.28 * s, 0.46 * s, 1.08 * s, '#ff2a6d', '#ff85a1', 0.08, 0, 0, flash, 0.25, 2, 1);
      for (const side of [-1, 1]) {
        this.wCyl(wx + side * 0.58 * s, wy + 1.65 * s, wz, 0.24 * s, 0.52 * s, '#ffbe0b', 0.2, 0, side * -0.45, flash, 0.45);
      }
    } else {
      // Armor shattered! Spinning copper reactor coil exposed!
      this.wCyl(wx, wy + 1.42 * s, wz, 0.58 * s, 0.38 * s, '#ff9f1c', 0.2, time * 0.008, 0, flash, 0.75);
      this.wSphere(wx, wy + 1.68 * s, wz, 0.36 * s, '#00f5d4', flash, 0.95);
    }
    // Glowing Red Cyclops Laser Scanner Eye
    const scanX = Math.sin(time / 150 + id) * 0.26 * s;
    this.wBox(wx, wy + 0.88 * s, wz + 0.58 * s, 0.96 * s, 0.32 * s, 0.22 * s, '#070b17', 0, 0, 0, 0, 0.05);
    this.wSphere(wx + scanX, wy + 0.88 * s, wz + 0.68 * s, 0.30 * s, damaged ? '#ffbe0b' : '#ff2a6d', flash, 0.95);
  }

  /**
   * 3D Aerodynamic Galaxy-Liner Bullet Train & Booster Coach
   */
  addBulletTrain3D(wx, wy, wz, scale = 1, { time = 0, yaw = 0, slot = 3, gold = false, flash = 0 } = {}) {
    const s = scale;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const pos = (lx, ly, lz) => [wx + (lx * cos + lz * sin) * s, wy + ly * s, wz + (-lx * sin + lz * cos) * s];

    this.wShadow(wx, wy, wz, 2.2 * s, 1.1 * s);
    // Sleek Fuselage Chassis
    const [bx, by, bz] = pos(0, 0.95, 0);
    this.wLegoBlock(bx, by, bz, 3.2 * s, 1.15 * s, 1.55 * s, gold ? '#ffbe0b' : '#1d4ed8', gold ? '#fff3b0' : '#38bdf8', 0, yaw, 0, flash, gold ? 0.35 : 0.18, 3, 1);
    // Streamlined Nose & Cyan Panoramic Canopy
    const [nx, ny, nz] = pos(1.65, 0.82, 0);
    this.wBox(nx, ny, nz, 1.1 * s, 0.85 * s, 1.38 * s, '#38bdf8', 0, yaw, -0.25, flash, 0.28);
    const [cx, cy, cz] = pos(0.85, 1.35, 0);
    this.wBox(cx, cy, cz, 1.45 * s, 0.62 * s, 1.28 * s, '#00f5d4', 0, yaw, -0.15, flash, 0.65);

    // 6 Glowing Mag-Lev Wheel Pods
    for (const lx of [-1.1, 0, 1.1]) {
      for (const lz of [-0.78, 0.78]) {
        const [wx2, wy2, wz2] = pos(lx, 0.35, lz);
        this.wCyl(wx2, wy2, wz2, 0.58 * s, 0.24 * s, '#00f5d4', Math.PI * 0.5, yaw, time * 0.01, flash, 0.75);
      }
    }

    // Stage 1: Front Golden Plasma Ram
    if (slot >= 1 || gold) {
      const [rx, ry, rz] = pos(-1.75, 0.75, 0);
      this.wBox(rx, ry, rz, 0.65 * s, 0.68 * s, 1.68 * s, '#ffbe0b', 0, yaw, 0, flash, 0.48);
    }
    // Stage 2: Twin 3D Angled Golden Valkyrie Booster Wings
    if (slot >= 2 || gold) {
      for (const side of [-1, 1]) {
        const [wx3, wy3, wz3] = pos(-0.35, 1.45, side * 1.15);
        this.wBox(wx3, wy3, wz3, 1.45 * s, 0.22 * s, 0.95 * s, '#ffbe0b', side * 0.35, yaw, 0.15, flash, 0.52);
      }
    }
    // Stage 3: Twin 3D Plasma Afterburner Jet Cones
    if (slot >= 3 || gold) {
      for (const side of [-0.45, 0.45]) {
        const [jx, jy, jz] = pos(2.35, 0.85, side);
        this.wCyl(jx, jy, jz, 0.55 * s, (1.15 + Math.sin(time / 40) * 0.25) * s, '#00f5d4', 0, yaw, Math.PI * 0.5, 0, 0.95);
      }
    }
  }

  /**
   * MODE 1: Full-3D Highway Mecha Squad Shooter (`renderBattle`)
   * Camera positioned behind the 3D squad looking down the 3D suspension bridge over a 3D ocean!
   */
  renderBattle(view) {
    const c = view.art.c;
    const game = view.game;
    const s = game.state;
    const t = view.reduced ? 0 : view.time;
    this.beginPass();

    const camFollowX = (view.squadX || s.x || 0) * 2.2;
    const shakeX = s.shakeMs > 0 ? Math.sin(t * 0.12) * 0.35 : 0;
    const shakeY = s.shakeMs > 0 ? Math.cos(t * 0.15) * 0.25 : 0;
    this.setCamera(camFollowX * 0.45 + shakeX, 11.8 + shakeY, 19.2, camFollowX * 0.25, 1.4, -7.5);

    const dist = s.distance || 0;

    // 1. 3D Animated Ocean Waves & Escort Ships below the bridge (y = -3.2)
    this.wBox(0, -3.5, -28, 95, 0.4, 110, '#0a3d62', 0, 0, 0, 0, 0.08);
    for (let i = 0; i < 10; i++) {
      const wz = -65 + ((i * 9 + dist * 1.8) % 80);
      const wx = (i % 2 === 0 ? -1 : 1) * (11 + (i % 3) * 4.5);
      this.wBox(wx, -3.2, wz, 3.8, 0.12, 0.9, '#00f5d4', 0, 0, 0, 0, 0.45);
    }

    // 2. Full-3D Highway Suspension Bridge Deck, Glowing Neon Lanes & Open-Arch Crimson Pylon Towers
    this.wBox(0, -0.35, -26, 9.6, 0.7, 96, '#1e293b', 0, 0, 0, 0, 0.05);
    this.wBox(0, 0.02, -26, 8.4, 0.06, 96, '#334155', 0, 0, 0, 0, 0.08);
    for (const lx of [-4.0, 0, 4.0]) {
      this.wBox(lx, 0.06, -26, lx === 0 ? 0.18 : 0.28, 0.08, 96, lx === 0 ? '#00f5d4' : '#ff2a6d', 0, 0, 0, 0, 0.55);
    }
    for (let i = 0; i < 16; i++) {
      const wz = 12 - ((i * 4.5 + dist * 1.6) % 72);
      this.wBox(0, 0.07, wz, 7.6, 0.05, 0.35, '#475569', 0, 0, 0, 0, 0.12);
      for (const side of [-4.45, 4.45]) {
        this.wCyl(side, 0.38, wz, 0.48, 0.55, '#ff2a6d', 0, 0, 0, 0, 0.28);
      }
    }
    for (const tz of [18 - (dist % 36), 54 - (dist % 36)]) {
      const wz = 6 - tz * 1.25;
      if (wz < -72 || wz > 2) continue;
      for (const side of [-5.1, 5.1]) {
        this.wLegoBlock(side, 4.2, wz, 1.1, 8.8, 1.2, '#e11d48', '#fda4af', 0, 0, 0, 0, 0.18, 1, 1);
        this.wSphere(side, 9.1, wz, 0.75, '#ffbe0b', 0, 0.75);
      }
    }

    // 3. 3D Boss Warning Lane Laser Telegraph on the 3D Bridge Floor
    if (s.attack) {
      const laneX = s.attack.lane === 2 ? 0 : s.attack.lane === 0 ? -2.2 : 2.2;
      const warn = s.attack.phase === 'warning';
      this.wBox(laneX, 0.12, -5.5, 2.8, 0.08, 22, warn ? '#ff2a6d' : '#ffbe0b', 0, 0, 0, 0, warn ? 0.75 : 0.95, 0.65);
    }

    // 4. 3D Multiplier & Weapon Support Gates
    this.projectedGates = [];
    for (const gate of game.gates) {
      const wz = 6 - gate.z * 1.12;
      if (wz < -68 || wz > 12) continue;
      for (let i = 0; i < 2; i++) {
        const wx = i === 0 ? -2.15 : 2.15;
        const blue = i === gate.blueSide;
        const col = blue ? '#00b4d8' : '#ff2a6d';
        const glowCol = blue ? '#00f5d4' : '#ff85a1';
        this.wBox(wx - 1.75, 1.8, wz, 0.34, 3.6, 0.42, col, 0, 0, 0, 0, 0.35);
        this.wBox(wx + 1.75, 1.8, wz, 0.34, 3.6, 0.42, col, 0, 0, 0, 0, 0.35);
        this.wLegoBlock(wx, 3.65, wz, 3.85, 0.48, 0.52, col, glowCol, 0, 0, 0, 0, 0.48, 3, 1);
        this.wBox(wx, 1.8, wz, 3.3, 3.2, 0.12, glowCol, 0, 0, 0, 0, 0.65, 0.32);
        const proj = this.worldToScreen(wx, 2.0, wz);
        if (proj.visible) {
          this.projectedGates.push({ x: proj.x, y: proj.y, s: proj.s, text: gate.options[i].text, blue });
        }
      }
    }

    // 5. 3D Enemies, 3D Locks, 3D Supply Crates, 3D Barrels & 24-Part 3D Dreadnought Titan Boss!
    this.projectedEntities = [];
    for (const e of game.entities) {
      const wz = 6 - e.z * 1.12;
      const wx = e.x * 3.6;
      if (wz < -70 || wz > 13) continue;
      const flash = Math.min(1, (e.hitMs || 0) / 110);
      const hpRatio = Math.max(0, Math.min(1, (e.hp ?? 1) / Math.max(1, e.maxHp ?? 1)));

      if (e.kind === 'enemy') {
        this.addSpiderDrone3D(wx, 0, wz, 0.95, { time: t, id: e.id, hpRatio, flash });
        const proj = this.worldToScreen(wx, 2.2, wz);
        if (proj.visible) this.projectedEntities.push({ x: proj.x, y: proj.y, s: proj.s, hp: Math.ceil(e.hp), ratio: hpRatio, kind: 'enemy' });
      } else if (e.kind === 'lock') {
        this.wShadow(wx, 0, wz, 1.1, 1.1);
        this.wCyl(wx, 1.1, wz, 1.55, 0.75, '#ffbe0b', 0.4, t * 0.004, 0, flash, 0.42);
        const bolts = Math.max(1, Math.ceil(hpRatio * 4));
        for (let b = 0; b < bolts; b++) {
          const ang = (b * Math.PI) / 2 + t * 0.003;
          this.wCyl(wx + Math.cos(ang) * 0.72, 1.1 + Math.sin(ang) * 0.45, wz + 0.35, 0.38, 0.38, '#00f5d4', 0.4, ang, 0, flash, 0.75);
        }
        const proj = this.worldToScreen(wx, 2.1, wz);
        if (proj.visible) this.projectedEntities.push({ x: proj.x, y: proj.y, s: proj.s, hp: Math.ceil(e.hp), ratio: hpRatio, kind: 'lock' });
      } else if (e.kind === 'crate' || e.kind === 'supply') {
        const col = e.kind === 'supply' ? '#00f5d4' : '#3b82f6';
        this.wShadow(wx, 0, wz, 1.1, 1.1);
        this.wLegoBlock(wx, 1.05 + Math.sin(t / 180 + e.id) * 0.15, wz, 1.65, 1.45, 1.45, col, '#e0f2fe', 0.12, t * 0.0025, 0, flash, 0.38, 2, 2);
        const proj = this.worldToScreen(wx, 2.3, wz);
        if (proj.visible) this.projectedEntities.push({ x: proj.x, y: proj.y, s: proj.s, hp: e.hp ? Math.ceil(e.hp) : '⚡', ratio: hpRatio, kind: e.kind });
      } else if (e.kind === 'boss') {
        // Colossal 24-Part 3D Dreadnought Titan Mecha Boss + Captured 3D Galaxy-Liner Bullet Train!
        const stage = hpRatio < 0.34 ? 3 : hpRatio < 0.67 ? 2 : 1;
        const warn = s.attack?.phase === 'warning';
        const slam = s.attack?.phase === 'slam';
        const liftY = warn ? 0.65 + Math.sin(t / 70) * 0.2 : 0;

        // Captured 3D Bullet Train behind the Boss
        this.addBulletTrain3D(0, 0.1, wz - 3.6, 1.25, { time: t, yaw: 0.25, slot: 3 - Math.min(2, game.harbor?.state.locksBroken ?? 0), gold: (game.harbor?.state.locksBroken ?? 0) >= 2 });

        this.wShadow(0, 0, wz, 3.6, 2.2);
        // Boss 3D Armored Legs / Treads
        for (const side of [-1.65, 1.65]) {
          this.wLegoBlock(side, 1.05, wz, 1.25, 2.1, 1.85, '#1e293b', '#475569', 0, 0, 0, flash, 0.12, 1, 2);
        }
        // Boss Massive 3D Battleship Torso Cowl
        this.wLegoBlock(0, 3.35 + liftY, wz, 4.6, 2.65, 2.4, '#1f2d50', '#ff2a6d', 0.06, Math.sin(t / 340) * 0.08, 0, flash, 0.18, 4, 2);
        // Spinning 3D Reactor Core Sphere in Chest
        this.wSphere(0, 3.15 + liftY, wz + 1.25, 1.35 + Math.sin(t / 80) * 0.15, stage >= 3 ? '#ff2a6d' : '#00f5d4', flash, 0.92);
        // Detachable 3D Shoulder Missile Pods (blow off below 67% HP)
        if (stage < 3) {
          for (const side of [-1, 1]) {
            if (stage === 2 && side > 0) continue;
            this.wLegoBlock(side * 2.85, 4.35 + liftY, wz, 1.15, 1.35, 1.4, '#ff2a6d', '#ffbe0b', 0.15, side * -0.2, 0, flash, 0.35, 2, 1);
          }
        }
        // Menacing 3D V-Visor & Glowing Optics
        this.wBox(0, 4.15 + liftY, wz + 1.22, 3.2, 0.85, 0.35, '#070b19', 0, 0, 0, 0, 0.08);
        for (const side of [-0.85, 0.85]) {
          this.wBox(side, 4.18 + liftY, wz + 1.42, 0.82, 0.26, 0.15, warn || stage >= 2 ? '#ff2a6d' : '#ffbe0b', 0, 0, side < 0 ? -0.22 : 0.22, flash, 0.95);
        }
        // Articulated 3D Hydraulic Pincer Claw Arms (physically slam the bridge deck!)
        for (const side of [-1, 1]) {
          const armX = side * 3.1;
          const armZ = slam ? wz + 4.5 : wz + 0.8;
          const armY = slam ? 1.1 : 2.6 + liftY + Math.sin(t / 150 + side) * 0.25;
          this.wBox(armX, armY + 0.9, (wz + armZ) * 0.5, 0.72, 2.2, 0.85, '#334155', slam ? 0.85 : 0.35, side * -0.18, side * 0.25, flash, 0.15);
          this.wCyl(armX, armY - 0.1, armZ, 1.15, 0.65, '#ff2a6d', 0.3, t * 0.004 * side, 0, flash, 0.45);
          this.wBox(armX - side * 0.35, armY - 0.65, armZ + 0.3, 0.28, 0.85, 0.45, '#ffbe0b', 0.2, 0, side * -0.35, flash, 0.65);
          this.wBox(armX + side * 0.35, armY - 0.65, armZ + 0.3, 0.28, 0.85, 0.45, '#ffbe0b', 0.2, 0, side * 0.35, flash, 0.65);
        }
        const proj = this.worldToScreen(0, 5.4 + liftY, wz);
        if (proj.visible) this.projectedEntities.push({ x: proj.x, y: proj.y, s: proj.s, hp: Math.ceil(e.hp), ratio: hpRatio, kind: 'boss' });
      } else {
        // 3D Energy Turret Barrel / Cargo Pod
        this.wShadow(wx, 0, wz, 1.0, 1.0);
        this.wCyl(wx, 1.05, wz, 1.45, 1.75, e.cargo ? '#f59e0b' : '#e11d48', 0, t * 0.003 + e.id, 0, flash, 0.25);
        this.wCyl(wx, 2.02, wz, 0.85, 0.32, '#fef08a', 0, -t * 0.004, 0, flash, 0.45);
        const proj = this.worldToScreen(wx, 2.35, wz);
        if (proj.visible) this.projectedEntities.push({ x: proj.x, y: proj.y, s: proj.s, hp: Math.ceil(e.hp), ratio: hpRatio, kind: 'barrel' });
      }
    }

    // 6. 3D Plasma Projectiles (Bullets)
    for (const b of game.bullets) {
      const wz = 6 - b.z * 1.12;
      const wx = b.x * 3.6;
      if (wz < -68 || wz > 12) continue;
      const col = b.powered ? '#00f5d4' : '#ffbe0b';
      this.wSphere(wx, 1.25, wz, b.powered ? 0.52 : 0.38, col, 0, 0.95);
      this.wCyl(wx, 1.25, wz + 0.65, b.powered ? 0.26 : 0.18, 1.15, '#ffffff', Math.PI * 0.5, 0, 0, 0, 0.95);
    }

    // 7. 3D Star-Ranger Mecha Squad at the Front of the Bridge!
    const count = Math.max(1, Math.min(12, Math.round(view.displaySquad || s.squad || 1)));
    const squadCenterX = (view.squadX ?? s.x ?? 0) * 3.6;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 4), col = i % 4, cols = Math.min(4, count - row * 4);
      const mx = squadCenterX + (col - (cols - 1) * 0.5) * 0.95;
      const mz = 7.4 + row * 1.05;
      const isLeader = i === 0;
      this.wShadow(mx, 0, mz, isLeader ? 0.72 : 0.56);
      this.addMechaHero3D(mx, 0, mz, isLeader ? 0.78 : 0.62, {
        time: t + i * 45,
        yaw: Math.PI + (view.squadLean || 0) * 1.5,
        run: true,
        gold: s.powerMs > 0,
        palette: view.profile?.palette,
        crown: isLeader,
        rifle: true,
      });
    }
    this.projectedSquad = this.worldToScreen(squadCenterX, 0.2, 9.6);

    // 8. 3D Tumbling Battle Debris Voxels
    for (const d of view.debris) {
      if (d.life <= 0) continue;
      const w = this.screenToWorld(d.x, d.y, 1.2);
      this.wBox(w.x, w.y, w.z, 0.38, 0.28, 0.28, d.color || '#ffbe0b', d.angle, d.angle * 1.3, d.angle * 0.7, 0, 0.35);
    }

    this.endPass(c);
  }

  /**
   * MODE 2: Full-3D Sky-Fortress Spiral Tower Climber (`renderStairs`)
   * True 3D camera follows your 3D Star-Ranger Mecha climbing floating 3D voxel platforms around a 3D Lighthouse Spire!
   */
  renderStairs(view) {
    const c = view.ctx;
    const state = view.game.state;
    const t = view.reducedMotion ? 0 : view.time;
    this.beginPass();

    // Map 2D stair pose (x in 120..600, y in negative pixels) to 3D Tower coordinates
    const heroX = ((view.pose.x - 360) / 52);
    const heroY = (-view.pose.y / 54) + (view.pose.lift / 48);
    const camY = (-view.cameraY / 54);
    const shakeX = view.shake > 0 ? Math.sin(t * 0.14) * 0.28 : 0;

    this.setCamera(heroX * 0.38 + shakeX, camY + 6.8, 15.2, heroX * 0.28, camY + 0.8, -1.5);

    // 1. Towering 3D Central Cloud Lighthouse Spire & Rotating 3D Golden Ring-Gears in Background (z = -6.5)
    for (let i = -2; i < 6; i++) {
      const segY = Math.floor(camY / 4) * 4 + i * 4;
      const isRed = Math.abs(Math.round(segY / 4)) % 2 === 1;
      this.wCyl(0, segY, -6.8, 4.4, 4.0, isRed ? '#e11d48' : '#e2e8f0', 0, t * 0.0005, 0, 0, 0.08);
      if (isRed) {
        this.wCyl(0, segY + 1.9, -6.8, 5.2, 0.45, '#ffbe0b', 0, -t * 0.0015, 0, 0, 0.35);
      }
    }

    // 2. Floating 3D Voxel Stair Platforms, 3D Rotating Coins & 3D Golden Stomped Star Blocks
    this.projectedSteps = [];
    for (let i = view.game.steps.length - 1; i >= 0; i--) {
      const step = view.game.steps[i];
      const tileSpring = (view.tiles.get(step.id)?.value ?? 0) / 54;
      const sx = (step.x - 360) / 52;
      const sy = (-step.y / 54) - tileSpring;
      if (sy < camY - 9 || sy > camY + 11) continue;
      const sz = Math.sin(step.id * 0.45) * 0.85;

      const stepped = step.id <= state.step;
      const current = step.id === state.step;
      const milestone = step.id > 0 && step.id % 10 === 0;
      const gateFloor = step.id > 0 && step.id % 15 === 0;

      const bodyCol = gateFloor ? '#f59e0b' : stepped ? '#ffbe0b' : milestone ? '#8b5cf6' : '#06b6d4';
      const topCol = gateFloor || stepped ? '#fef08a' : milestone ? '#ddd6fe' : '#a5f3fc';

      this.wLegoBlock(sx, sy - 0.32, sz, 2.35, 0.62, 1.65, bodyCol, topCol, 0, 0, 0, current ? 0.35 : 0, stepped ? 0.35 : 0.12, 2, 1);
      // Glowing Under-Thruster Core beneath each floating 3D platform
      this.wCyl(sx, sy - 0.72, sz, 1.35, 0.22, stepped ? '#00f5d4' : '#38bdf8', 0, 0, 0, 0, 0.65);

      if (stepped && !current) {
        // Spinning 3D Star Crystal above stomped golden platforms
        this.wBox(sx, sy + 0.42, sz, 0.42, 0.42, 0.42, '#00f5d4', t * 0.004 + step.id, t * 0.005, 0.78, 0, 0.85);
      } else if (step.id > state.step && step.id <= state.step + 7) {
        // Rotating 3D Golden Coin above upcoming platforms
        const bob = Math.sin(t / 220 + step.id) * 0.15;
        this.wCyl(sx, sy + 0.68 + bob, sz, 0.62, 0.16, '#ffbe0b', Math.PI * 0.5, t * 0.0045 + step.id, 0, 0, 0.55);
      }

      if (gateFloor || (milestone && !current)) {
        const proj = this.worldToScreen(sx, sy + 1.15, sz);
        if (proj.visible) {
          this.projectedSteps.push({ x: proj.x, y: proj.y, text: gateFloor ? `★ ${step.id}F 등대 브릿지` : `${step.id}F`, gold: gateFloor });
        }
      }
    }

    // 3. 14-Part 3D Articulated Star-Ranger Mecha Hero Climbing the 3D Tower!
    const currentStep = view.game.steps.find(st => st.id === state.step);
    const heroZ = currentStep ? Math.sin(currentStep.id * 0.45) * 0.85 : 0;
    const flight = view.jump ? Math.sin((view.jump.elapsed / view.jump.duration) * Math.PI) : 0;
    this.wShadow(heroX, (-view.pose.y / 54), heroZ, 0.85 * (1 - flight * 0.35));
    this.addMechaHero3D(heroX, heroY, heroZ, 1.05, {
      time: t,
      yaw: state.facing * 0.55,
      run: Boolean(view.jump),
      jump: flight,
      gold: state.combo >= 8 || state.mode === 'AUTO_CLIMB',
      palette: view.game.wallet?.palette,
      crown: true,
    });
    this.projectedHero = this.worldToScreen(heroX, heroY + 1.2, heroZ);

    this.endPass(c);
  }

  /**
   * MODE 3: Full-3D Mag-Lev Rail Cyber Surfer & Train Chaser (`renderRunner`)
   * Diagonal 3D Action Chase Camera overlooking the 3D Viaduct Track, 3D Neo-Harbor Skyline,
   * 3D Runaway Bullet Train, 3D Hover Power Crates, 3D Cyber-Beetle Bots, and 3D Surfing Mecha Hero!
   */
  renderRunner(view, wagonX, hitReaction) {
    const c = view.art.c;
    const s = view.runner.state;
    const t = view.reduced ? 0 : view.time;
    const d = s.distance || 0;
    this.beginPass();

    // Dynamic 3D Chase Camera framing BOTH the 3D Surfing Mecha Hero (left) and the 3D Runaway Bullet Train (right)!
    const heroJumpY = (s.y || 0) / 56;
    this.setCamera(-0.8, 4.8 + heroJumpY * 0.2, 16.2, 0.1, 1.9 + heroJumpY * 0.15, -0.5);

    // 1. 3D Neo-Harbor City Skyline Towers & 3D Suspension Bridge Arches in Background (z = -12..-7)
    for (let i = 0; i < 8; i++) {
      const bx = -14 + ((((i * 5.2 - d * 0.012) % 36) + 36) % 36);
      const bh = 5.5 + (i * 2.3) % 6.5;
      const col = i % 2 === 0 ? '#1e3a8a' : '#0f172a';
      this.wBox(bx, bh * 0.5 - 1.5, -10.5 - (i % 2) * 2.5, 2.8, bh, 2.6, col, 0, 0, 0, 0, 0.12);
      this.wBox(bx, bh - 1.3, -9.1 - (i % 2) * 2.5, 2.2, 0.28, 0.2, i % 3 === 0 ? '#ff2a6d' : '#00f5d4', 0, 0, 0, 0, 0.85);
    }

    // 2. Full-3D Mag-Lev Viaduct Bridge Deck, Glowing Speed Rails & 3D Truss Pillars
    this.wBox(0, -0.55, 0, 28, 1.1, 4.8, '#0f172a', 0, 0, 0, 0, 0.06);
    this.wBox(0, 0.02, 0, 28, 0.08, 4.2, '#1e293b', 0, 0, 0, 0, 0.1);
    for (const rz of [-1.45, 0, 1.45]) {
      this.wBox(0, 0.08, rz, 28, 0.10, 0.22, s.goldMs ? '#ffbe0b' : '#00f5d4', 0, 0, 0, 0, 0.75);
    }
    for (let i = 0; i < 10; i++) {
      const tx = -12 + ((((i * 2.8 - d * 0.045) % 26) + 26) % 26);
      this.wLegoBlock(tx, 0.06, 0, 0.65, 0.14, 3.8, '#334155', s.goldMs ? '#ffbe0b' : '#38bdf8', 0, 0, 0, 0, 0.22, 1, 2);
      if (i % 2 === 0) {
        this.wBox(tx, -3.2, 0, 0.85, 5.5, 3.2, '#1e293b', 0, 0, 0, 0, 0.05);
      }
    }

    // 3. 3D Runaway Galaxy-Liner Bullet Train ahead on the rails (progressively bolts on 3D Ram -> 3D Wings -> 3D Jets!)
    const trainWorldX = ((wagonX - 400) / 58) + 0.6;
    this.addBulletTrain3D(trainWorldX, 0.08, 0, 0.92, {
      time: t,
      yaw: Math.PI,
      slot: s.slot || 0,
      gold: s.goldMs > 0,
      flash: Math.min(1, hitReaction * 1.2),
    });
    this.wSphere(trainWorldX - 0.2, 1.85, 0, 0.58, '#10b981', 0, 0.28);
    this.wBox(trainWorldX - 0.1, 2.15, 0, 0.48, 0.22, 0.52, '#ffbe0b', 0, 0, 0, 0, 0.55);
    this.projectedTrain = this.worldToScreen(trainWorldX, 2.65, 0);

    // 4. 3D Hover Power Crates, 3D Rotating Coins & 3D Cyber-Beetle Patrol Bots on the Track
    this.projectedCrates = [];
    for (const item of view.runner.items.active) {
      const ix = (item.x - 400) / 58;
      if (ix < -10 || ix > 12) continue;
      if (item.kind === 'word') {
        const iy = ((870 - item.y) / 56) + Math.sin(t / 140 + item.x * 0.02) * 0.16;
        this.wShadow(ix, 0, 0, 0.95, 0.7);
        this.wLegoBlock(ix, iy, 0, 1.85, 1.05, 1.15, '#ffbe0b', '#fef08a', 0.12, Math.sin(t / 240) * 0.18, 0, 0, 0.35, 3, 1);
        this.wCyl(ix - 1.12, iy, 0, 0.42, 0.32, '#00f5d4', 0, t * 0.006, Math.PI * 0.5, 0, 0.85);
        this.wCyl(ix + 1.12, iy, 0, 0.42, 0.32, '#00f5d4', 0, -t * 0.006, Math.PI * 0.5, 0, 0.85);
        const proj = this.worldToScreen(ix, iy, 0.65);
        if (proj.visible) {
          const stageIdx = s.slot % 3;
          const title = ['⚡ 1단 연결기', '🪽 2단 부스터', '🚀 3단 스타제트'][stageIdx];
          this.projectedCrates.push({ x: proj.x, y: proj.y, title });
        }
      } else if (item.kind === 'coin') {
        const iy = ((870 - item.y) / 56) + Math.sin(t / 180 + item.x) * 0.12;
        this.wCyl(ix, iy, 0, 0.65, 0.18, '#ffbe0b', Math.PI * 0.5, t * 0.005 + item.x, 0, 0, 0.55);
      } else {
        this.addSpiderDrone3D(ix, 0.06, 0, 0.78, { time: t, id: Math.round(item.x), hpRatio: 1, flash: 0 });
        this.wCyl(ix, 1.38, 0, 0.85, 0.22, '#00f5d4', 0, t * 0.005, 0, 0, 0.85);
      }
    }

    // 5. 3D Spent Steel Blocks, 3D Ejected Star Cores & 3D Crushed Tumbling Bots
    for (const b of view.spentBlocks) {
      if (b.life <= 0) continue;
      const bx = (b.x - 400) / 58;
      const by = ((870 - (b.y + b.bumpY)) / 56);
      this.wLegoBlock(bx, by, 0, 1.85, 0.98, 1.1, '#475569', '#94a3b8', 0.1, 0, 0, 0, 0.12, 2, 1);
    }
    for (const u of view.powerups) {
      if (u.life <= 0) continue;
      const ux = (u.x - 400) / 58, uy = (870 - u.y) / 56;
      this.wSphere(ux, uy, 0.4, 0.58, '#00f5d4', 0, 0.95);
      this.wBox(ux, uy, 0.4, 0.48, 0.48, 0.48, '#ffbe0b', t * 0.009, t * 0.007, 0.78, 0, 0.85);
    }
    for (const m of view.crushedMechs) {
      if (m.life <= 0) continue;
      const mx = (m.x - 400) / 58, my = (870 - m.y) / 56;
      this.wLegoBlock(mx, my, 0.5, 1.35, 0.38, 0.98, '#e11d48', '#fda4af', m.angle, m.angle * 1.4, m.angle * 0.9, 0.35, 0.25, 1, 1);
    }

    // 6. 14-Part 3D Star-Ranger Mecha Hero Surfing & Jumping on the 3D Mag-Lev Rail!
    const heroX = -2.4;
    this.wShadow(heroX, 0.05, 0, Math.max(0.45, 0.88 - heroJumpY * 0.12));
    this.wBox(heroX, heroJumpY + 0.14, 0, 1.55, 0.16, 0.82, s.goldMs ? '#ffbe0b' : '#00f5d4', 0, 0, Math.max(-0.25, Math.min(0.25, (s.vy || 0) / 2200)), 0, 0.75);
    this.addMechaHero3D(heroX, heroJumpY + 0.22, 0, s.goldMs ? 1.15 : 0.96, {
      time: t,
      yaw: Math.PI * 0.5,
      run: heroJumpY <= 0.1,
      jump: Math.min(1, heroJumpY / 3),
      gold: s.goldMs > 0,
      palette: view.profile?.palette,
      crown: true,
    });

    this.endPass(c);
  }

  /**
   * MODE 4: Full-3D Mecha Brawl Arena (`renderPlaza`)
   * Brawl-Stars / Archero Tilted 3D Arena with 3D Voxel Checkerboard Floor, 3D Starlight Bullet Locomotive Dock,
   * 3D Commander Mecha, 3D Rotating Reactor Cores, 3D Enemy Chaser Bots, and Automatic 3D Plasma Combat!
   */
  renderPlaza(view, dock, collectedTotal) {
    const c = view.art.c;
    const s = view.plaza.state;
    const t = view.reduced ? 0 : view.time;
    this.beginPass();

    const px = s.x || 0, pz = s.z || 0;
    this.setCamera(px * 0.35, 15.8, pz * 0.35 + 14.6, px * 0.2, 0.4, pz * 0.2 + 0.4);

    // 1. 3D Sky-Harbor Voxel Arena Floor Grid (-4..3 in X and Z) + Glowing Border Rim
    this.wBox(0, -0.55, 0, 10.6, 0.7, 10.6, '#0f172a', 0, 0, 0, 0, 0.12);
    this.wBox(0, -0.18, 0, 10.1, 0.15, 10.1, '#00f5d4', 0, 0, 0, 0, 0.55);
    for (let x = -4; x < 4; x++) {
      for (let z = -4; z < 4; z++) {
        const isBorder = x === -4 || x === 3 || z === -4 || z === 3;
        const even = (x + z) % 2 === 0;
        const col = isBorder ? '#1e3a8a' : even ? '#1e293b' : '#334155';
        this.wBox(x + 0.5, -0.05, z + 0.5, 0.94, 0.22, 0.94, col, 0, 0, 0, 0, isBorder ? 0.18 : 0.05);
      }
    }

    // 2. 4 Corner 3D Plasma Turret Beacon Towers
    for (const [cx, cz] of [[-4.4, -4.4], [4.4, -4.4], [4.4, 4.4], [-4.4, 4.4]]) {
      this.wLegoBlock(cx, 1.1, cz, 1.1, 2.2, 1.1, '#1e3a8a', '#38bdf8', 0, 0, 0, 0, 0.22, 1, 1);
      this.wSphere(cx, 2.55 + Math.sin(t / 180 + cx) * 0.12, cz, 0.62, '#00f5d4', 0, 0.85);
    }

    // 3. 3D Starlight Bullet Locomotive at the Docking Pier (-2.4, 0, 3.6) + Progressive 3D Reactor Cores!
    const flash = Math.min(1, view.dockPulseMs / 240);
    this.addBulletTrain3D(-2.3, 0.12, 3.65, 0.85, {
      time: t,
      yaw: 0.35,
      slot: collectedTotal,
      gold: collectedTotal >= 3 || s.phase === 'success',
      flash,
    });
    for (let i = 0; i < Math.min(3, collectedTotal); i++) {
      const col = ['#ff2a6d', '#00f5d4', '#ffbe0b'][i];
      this.wSphere(-3.1 + i * 0.8, 1.65, 3.65, 0.46, col, flash, 0.95);
    }

    // 4. 3D Harbor Commander Mecha at the Docking Ring (0, 0, 3.15)
    this.wCyl(0, 0.08, 3.15, view.plaza.ready ? 2.2 : 1.7, 0.08, view.plaza.ready ? '#ffbe0b' : '#00f5d4', 0, t * 0.003, 0, 0, 0.75);
    this.addMechaHero3D(0, 0.12, 3.15, 0.88, {
      time: t,
      yaw: Math.PI,
      run: false,
      gold: view.plaza.ready,
      palette: { shirt: '#2563eb', helmet: '#38bdf8' },
      crown: true,
    });
    this.projectedCaptain = this.worldToScreen(0, 2.6, 3.15);

    // 5. 3D Holographic Part Pedestals & 3D Rotating Engine Cores
    this.projectedItems = [];
    const partColors = { key: '#ff2a6d', star: '#38bdf8', gem: '#00f5d4', book: '#a855f7', console: '#ffbe0b', bomb: '#64748b' };
    for (const item of view.plaza.items.active) {
      const ix = item.x, iz = item.z;
      const pCol = partColors[item.kind] || '#ffbe0b';
      const isTarget = view.plaza.mission.some(m => m.kind === item.kind);
      this.wLegoBlock(ix, 0.25, iz, 1.15, 0.42, 1.15, item.collected ? '#065f46' : '#1e293b', item.collected ? '#00f5d4' : '#475569', 0, 0, 0, 0, item.collected ? 0.45 : 0.12, 2, 2);
      if (item.collected) {
        this.wCyl(ix, 0.62, iz, 0.75, 0.24, '#00f5d4', 0, t * 0.005, 0, 0, 0.85);
      } else {
        const hoverY = 1.05 + Math.sin(t / 180 + ix) * 0.16;
        const rot = t * 0.004 + ix;
        if (item.kind === 'star' || item.kind === 'gem') {
          this.wBox(ix, hoverY, iz, 0.68, 0.68, 0.68, pCol, 0.65, rot, 0.78, 0, 0.75);
        } else if (item.kind === 'key' || item.kind === 'bomb') {
          this.wCyl(ix, hoverY, iz, 0.72, 0.42, pCol, 0.55, rot, 0.35, 0, 0.65);
        } else {
          this.wLegoBlock(ix, hoverY, iz, 0.78, 0.52, 0.62, pCol, '#fef08a', 0.35, rot, 0, 0, 0.55, 1, 1);
        }
        // Magnetic Tractor Beam when player approaches target core!
        const dist = Math.hypot(ix - px, iz - pz);
        if (s.phase === 'active' && dist < 1.85) {
          this.wCyl((ix + px) * 0.5, 0.85, (iz + pz) * 0.5, 0.16, dist, isTarget ? '#00f5d4' : '#ff2a6d', Math.PI * 0.5, Math.atan2(ix - px, iz - pz), 0, 0, 0.85);
        }
      }
      const proj = this.worldToScreen(ix, 1.85, iz);
      if (proj.visible) {
        this.projectedItems.push({ x: proj.x, y: proj.y, item, near: Math.hypot(ix - px, iz - pz) < 1.65 });
      }
    }

    // 6. 3D Patrol Spider-Drones & Brawl-Style Auto-Fire Plasma Combat!
    let nearestHazard = null, minHDist = 99;
    for (const h of view.plaza.hazards.active) {
      const hDist = Math.hypot(h.x - px, h.z - pz);
      if (hDist < minHDist) { minHDist = hDist; nearestHazard = h; }
      const hitPulse = hDist < 2.8 && (Math.floor(t / 120) % 2 === 0) ? 0.65 : 0;
      this.addSpiderDrone3D(h.x, 0.08, h.z, 0.78, { time: t, id: 7, hpRatio: 1, flash: hitPulse });
    }
    // Spawn & render 3D auto-fire plasma bolts from Player Mecha toward nearest Spider-Drone!
    if (nearestHazard && s.phase === 'active' && t - this.lastBrawlShot > 220) {
      this.lastBrawlShot = t;
      const dx = nearestHazard.x - px, dz = nearestHazard.z - pz, len = Math.max(0.1, Math.hypot(dx, dz));
      Object.assign(this.brawlBolts[this.brawlBoltCursor++ % this.brawlBolts.length], {
        x: px, y: 1.0, z: pz, vx: (dx / len) * 14, vz: (dz / len) * 14, life: 320,
      });
    }
    for (const b of this.brawlBolts) {
      if (b.life <= 0) continue;
      b.life -= 16;
      b.x += b.vx * 0.016;
      b.z += b.vz * 0.016;
      this.wSphere(b.x, 0.95, b.z, 0.34, '#00f5d4', 0, 0.95);
    }

    // 7. 14-Part 3D Star-Ranger Mecha Hero Running & Auto-Firing in the 3D Arena!
    const moving = Math.hypot(s.vx || 0, s.vz || 0) > 0.05;
    const heroYaw = moving ? Math.atan2(s.vx, s.vz) : (nearestHazard ? Math.atan2(nearestHazard.x - px, nearestHazard.z - pz) : 0);
    this.wShadow(px, 0.08, pz, 0.82);
    this.wCyl(px, 0.10, pz, 1.55 + Math.sin(t / 140) * 0.12, 0.06, view.plaza.ready ? '#ffbe0b' : '#00f5d4', 0, 0, 0, 0, 0.65);
    this.addMechaHero3D(px, 0.12, pz, 0.96, {
      time: t,
      yaw: heroYaw,
      run: moving,
      gold: view.plaza.ready || s.phase === 'success',
      palette: view.profile?.palette,
      crown: true,
      rifle: Boolean(nearestHazard),
    });

    // 8. 3D Flying Reactor Core Arcing into the 3D Bullet Locomotive on Pickup!
    for (const f of view.flyingCargo) {
      if (f.life <= 0) continue;
      const prog = 1 - f.life / f.duration;
      const w = this.screenToWorld(
        f.sx + (f.tx - f.sx) * prog,
        f.sy + (f.ty - f.sy) * prog - Math.sin(prog * Math.PI) * 145,
        1.4
      );
      this.wBox(w.x, w.y, w.z, 0.72, 0.72, 0.72, '#00f5d4', prog * 10, prog * 14, prog * 8, 0.2, 0.95);
    }

    this.endPass(c);
  }

  /**
   * LOBBY: 3D Mecha Hangar Showcase & Cartridge 3D Emblems (`renderLobby`)
   */
  renderLobby(view, cards) {
    const c = view.art.c;
    const t = view.motion?.matches ? 0 : view.time;
    this.beginPass();
    this.setCamera(0, 0, 20, 0, 0, 0);

    for (const card of cards) {
      const cx = card.x + 152, cy = card.y + 154;
      const rot = t * 0.0022 + card.x * 0.01;
      if (card.id === 'stairs') {
        this.addLegoBrick(cx - 22, cy + 18, -0.5, 52, 22, 36, '#06b6d4', '#a5f3fc', 0.35, rot, 0, 0, 0.25, 2);
        this.addLegoBrick(cx + 18, cy - 10, -0.2, 52, 22, 36, '#ffbe0b', '#fef08a', 0.35, rot, 0, 0, 0.35, 2);
      } else if (card.id === 'battle') {
        this.addLegoBrick(cx, cy - 14, -0.3, 64, 44, 44, '#ff2a6d', '#ffbe0b', 0.32, rot, 0, 0, 0.28, 2);
      } else if (card.id === 'runner') {
        this.addLegoBrick(cx + 12, cy - 18, -0.3, 56, 38, 40, '#ffbe0b', '#00f5d4', 0.32, rot, 0, 0, 0.32, 2);
      } else {
        this.addLegoBrick(cx, cy - 6, -0.3, 48, 42, 42, '#8b5cf6', '#00f5d4', 0.55, rot, 0.78, 0, 0.38, 2);
      }
    }

    this.endPass(c);
  }

  /**
   * JUICE: 3D Rigid-Body Voxel Explosion Physics (`renderJuice`)
   */
  renderJuice(juice) {
    const c = juice.art.c;
    this.beginPass();
    this.setCamera(0, 0, 20, 0, 0, 0);
    for (const b of juice.physics.bodies) {
      if (b.life <= 0) continue;
      const opacity = Math.min(1, b.life / 180);
      const w = this.screenToWorld(b.x, b.y, 2.0);
      if (b.kind === 'stud') {
        this.wCyl(w.x, w.y, w.z, (b.w * 1.25) * w.pxUnit, (b.h * 1.15) * w.pxUnit, b.front, b.angle * 1.4, b.angle * 1.8, b.angle * 0.9, 0, 0.35, opacity);
      } else {
        this.addLegoBrick(b.x, b.y, 2.0, b.w * 1.25, b.h * 1.2, b.w * 0.85, b.front, b.top, b.angle * 1.2, b.angle * 1.6, b.angle * 0.8, 0, 0.28, 2, opacity);
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
