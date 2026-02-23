/**
 * scene3d.js
 * Three.js scene construction, 3D object management, and per-frame updates.
 * Depends on: Three.js (global THREE), indicators.js
 */

'use strict';

/* =========================================================
   Orbit Controls
   ========================================================= */
class SimpleOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 1.5, 0);

    const off = new THREE.Vector3().copy(camera.position).sub(this.target);
    this.radius = off.length();
    this.theta  = Math.atan2(off.x, off.z);
    this.phi    = Math.acos(THREE.MathUtils.clamp(off.y / this.radius, -1, 1));

    this.rotateSpeed = 0.006;
    this.zoomSpeed   = 0.0015;
    this.minRadius   = 3;
    this.maxRadius   = 20;
    this.minPhi      = 0.1;
    this.maxPhi      = Math.PI / 2.05;

    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this._bind();
    this.update();
  }

  _bind() {
    const el = this.domElement;
    el.addEventListener('pointerdown', e => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!this.isDragging) return;
      this.theta -= (e.clientX - this.lastX) * this.rotateSpeed;
      this.phi   -= (e.clientY - this.lastY) * this.rotateSpeed;
      this.phi    = THREE.MathUtils.clamp(this.phi, this.minPhi, this.maxPhi);
      this.lastX  = e.clientX;
      this.lastY  = e.clientY;
      this.update();
    });
    const end = e => {
      this.isDragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    el.addEventListener('pointerup',    end);
    el.addEventListener('pointerleave', end);
    el.addEventListener('wheel', e => {
      e.preventDefault();
      this.radius = THREE.MathUtils.clamp(
        this.radius * Math.exp(e.deltaY * this.zoomSpeed),
        this.minRadius, this.maxRadius,
      );
      this.update();
    }, { passive: false });
  }

  update() {
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    const st = Math.sin(this.theta), ct = Math.cos(this.theta);
    this.camera.position.set(
      this.target.x + this.radius * sp * st,
      this.target.y + this.radius * cp,
      this.target.z + this.radius * sp * ct,
    );
    this.camera.lookAt(this.target);
  }
}

/* =========================================================
   Flask geometry — profile matched to surface disc table
   ========================================================= */

/**
 * Erlenmeyer lathe profile.
 * Points are [radius, y-height].
 * Keep widest point ≤ 0.90 so liquid disc never exceeds glass wall.
 */
const FLASK_PROFILE = [
  [0.10, 0.00],  // base centre
  [0.72, 0.04],  // base edge
  [0.82, 0.25],  // lower body
  [0.88, 0.60],  // widest (shoulder start)
  [0.88, 0.80],  // shoulder flat
  [0.72, 1.15],  // shoulder taper
  [0.38, 1.60],  // neck start
  [0.26, 1.82],  // neck
  [0.26, 2.02],  // top of neck
  [0.30, 2.05],  // rim flare
];

function _erlenmeyerGeometry() {
  return new THREE.LatheGeometry(
    FLASK_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    64,
  );
}

/**
 * Interpolate the inner radius of the flask at a given y height.
 * Subtracts glass wall thickness (0.015) from profile radius.
 */
const GLASS_WALL = 0.015;
function _flaskRadiusAt(y) {
  for (let i = 0; i < FLASK_PROFILE.length - 1; i++) {
    const [r0, y0] = FLASK_PROFILE[i];
    const [r1, y1] = FLASK_PROFILE[i + 1];
    if (y >= y0 && y <= y1) {
      const t = (y - y0) / (y1 - y0);
      return Math.max(0, r0 + t * (r1 - r0) - GLASS_WALL);
    }
  }
  return FLASK_PROFILE[FLASK_PROFILE.length - 1][0] - GLASS_WALL;
}

/* =========================================================
   Scene builder
   ========================================================= */
function buildScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8fafc);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(6, 4, 7);

  const controls = new SimpleOrbitControls(camera, renderer.domElement);

  // --- Lighting ---
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));

  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(8, 12, 6);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xb3d9ff, 0.35);
  fill.position.set(-6, 8, -4);
  scene.add(fill);

  // --- Glass material: visible but transparent ---
  // opacity 0.45 gives clear glass appearance with visible rim/edges
  const glassMat = new THREE.MeshPhysicalMaterial({
    color:            0xc8dde8,   // slightly blue-tinted glass
    metalness:        0,
    roughness:        0.04,
    transmission:     0.0,        // use opacity instead for r128 compat
    transparent:      true,
    opacity:          0.35,
    side:             THREE.FrontSide,
    depthWrite:       false,
  });

  // --- Lab bench ---
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.2, roughness: 0.7 }),
  );
  bench.position.set(0, -0.2, 0);
  bench.receiveShadow = true;
  scene.add(bench);

  _addStand(scene);

  // --- Burette ---
  const TUBE_OUTER = 0.11;
  const TUBE_INNER = 0.095;
  const BURETTE_H  = 3.0;

  const buretteOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(TUBE_OUTER, TUBE_OUTER, BURETTE_H, 48),
    glassMat.clone(),
  );
  buretteOuter.position.set(-0.2, 2.9, 0);
  buretteOuter.castShadow = true;
  scene.add(buretteOuter);

  // Graduation marks
  for (let i = 0; i <= 10; i++) {
    const mark = new THREE.Mesh(
      new THREE.CylinderGeometry(TUBE_OUTER + 0.001, TUBE_OUTER + 0.001, 0.008, 32),
      new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.5 }),
    );
    mark.position.set(
      buretteOuter.position.x,
      buretteOuter.position.y - BURETTE_H / 2 + (i / 10) * BURETTE_H,
      0,
    );
    scene.add(mark);
  }

  // Stopcock
  const stopcock = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.15, 24),
    new THREE.MeshStandardMaterial({ color: 0x0891b2, metalness: 0.7, roughness: 0.2 }),
  );
  stopcock.position.set(-0.2, 1.45, 0);
  stopcock.castShadow = true;
  scene.add(stopcock);

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.04, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.7, roughness: 0.2 }),
  );
  handle.position.set(-0.2, 1.45, 0.14);
  handle.castShadow = true;
  scene.add(handle);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.022, 0.15, 24),
    glassMat.clone(),
  );
  tip.rotation.x = Math.PI;
  tip.position.set(-0.2, 1.35, 0);
  tip.castShadow = true;
  scene.add(tip);

  // Burette liquid — bright, solid, visible through glass
  const buretteLiquidMat = new THREE.MeshStandardMaterial({
    color: 0x00bfff, metalness: 0.1, roughness: 0.3,
    emissive: 0x0088cc, emissiveIntensity: 0.4,
    transparent: true, opacity: 0.85,
  });

  const buretteFill = new THREE.Mesh(
    new THREE.CylinderGeometry(TUBE_INNER * 0.96, TUBE_INNER * 0.96, BURETTE_H - 0.02, 32),
    buretteLiquidMat,
  );
  buretteFill.position.set(buretteOuter.position.x, buretteOuter.position.y, 0);
  scene.add(buretteFill);

  const meniscus = new THREE.Mesh(
    new THREE.CylinderGeometry(TUBE_INNER * 0.97, TUBE_INNER * 0.97, 0.035, 32),
    new THREE.MeshBasicMaterial({ color: 0x0055bb, transparent: true, opacity: 0.9 }),
  );
  meniscus.position.set(buretteOuter.position.x, buretteOuter.position.y + BURETTE_H / 2, 0);
  scene.add(meniscus);

  // --- Erlenmeyer flask ---
  const flaskGlass = new THREE.Mesh(_erlenmeyerGeometry(), glassMat.clone());
  flaskGlass.position.set(-0.2, 0.0, 0);
  flaskGlass.castShadow = true;
  flaskGlass.receiveShadow = true;
  scene.add(flaskGlass);

  // Clip plane cuts the liquid at its surface (normal points DOWN, constant = height above flask base)
  const liquidClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.7);

  // Liquid fill — transparent, colour-changing
  const liqMat = new THREE.MeshStandardMaterial({
    color:           0xffffff,
    metalness:       0.0,
    roughness:       0.35,
    transparent:     true,
    opacity:         0.55,          // semi-transparent solution
    emissive:        0x888888,
    emissiveIntensity: 0.15,
    side:            THREE.DoubleSide,
    clippingPlanes:  [liquidClipPlane],
    depthWrite:      false,
  });

  const flaskLiquid = new THREE.Mesh(_erlenmeyerGeometry(), liqMat);
  flaskLiquid.scale.set(0.96, 1.0, 0.96);  // slightly inside glass wall
  flaskLiquid.position.copy(flaskGlass.position);
  scene.add(flaskLiquid);

  // Liquid surface disc — solid circle at the top of the liquid
  const flaskSurfaceMat = new THREE.MeshStandardMaterial({
    color:           0xffffff,
    metalness:       0.15,
    roughness:       0.25,
    transparent:     true,
    opacity:         0.70,
    emissive:        0x666666,
    emissiveIntensity: 0.15,
    side:            THREE.DoubleSide,
    depthWrite:      false,
  });

  const flaskSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 48),   // initial radius, updated every frame
    flaskSurfaceMat,
  );
  flaskSurface.rotation.x = -Math.PI / 2;
  flaskSurface.position.set(flaskGlass.position.x, flaskGlass.position.y + 0.70, flaskGlass.position.z);
  scene.add(flaskSurface);

  // pH probe
  const probe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 }),
  );
  probe.position.set(0.3, 1.5, 0);
  probe.rotation.z = -0.3;
  probe.castShadow = true;
  scene.add(probe);

  const probeTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 }),
  );
  probeTip.position.set(0.15, 0.95, 0);
  scene.add(probeTip);

  return {
    renderer, scene, camera, controls,
    buretteOuter, buretteFill, meniscus, handle, tip,
    flaskGlass, flaskLiquid, flaskSurface, liqMat, liquidClipPlane,
    TUBE_INNER, BURETTE_H,
  };
}

/* =========================================================
   Per-frame 3D update
   ========================================================= */
const _stirAxis = new THREE.Vector3(0, 1, 0);

function updateScene3D(refs, state) {
  const {
    buretteOuter, buretteFill, meniscus, handle,
    flaskGlass, flaskLiquid, flaskSurface, liquidClipPlane,
    TUBE_INNER, BURETTE_H,
  } = refs;

  // ---- Flask liquid level ----
  const volRatio  = (state.analyteVol + state.titrantVol) / state.analyteVol;
  const liqHeight = _clamp(0.60 * Math.pow(volRatio, 0.60), 0.20, 1.75);

  liquidClipPlane.constant = liqHeight;

  const liqTopY = flaskGlass.position.y + liqHeight;
  flaskSurface.position.y = liqTopY;

  // Surface disc radius from actual interpolated flask profile (no overflow)
  const innerR = _flaskRadiusAt(liqHeight) * 0.96;   // 0.96 keeps inside liquid mesh scale
  flaskSurface.geometry.dispose();
  flaskSurface.geometry = new THREE.CircleGeometry(Math.max(0.05, innerR), 48);

  // ---- Burette liquid level ----
  const remainFrac    = _clamp((state.titrantMax - state.titrantVol) / state.titrantMax, 0.02, 1.0);
  const fillHeight    = Math.max(0.1, BURETTE_H * remainFrac);
  const buretteBottomY = buretteOuter.position.y - BURETTE_H / 2;
  const liquidBottomY  = buretteBottomY + 0.05;

  buretteFill.geometry.dispose();
  buretteFill.geometry = new THREE.CylinderGeometry(TUBE_INNER * 0.96, TUBE_INNER * 0.96, fillHeight, 32);
  buretteFill.position.y = liquidBottomY + fillHeight / 2;
  meniscus.position.y    = liquidBottomY + fillHeight;

  // ---- Stopcock handle angle ----
  handle.rotation.z = state.dripOn
    ? THREE.MathUtils.mapLinear(state.dps, 0, 10, 0, Math.PI / 2)
    : 0;
}

function applyFlaskColor(refs, color) {
  // Apply colour with a fixed transparency — don't let emissive dominate
  refs.flaskLiquid.material.color.copy(color);
  refs.flaskLiquid.material.emissive.copy(color).multiplyScalar(0.2);
  refs.flaskSurface.material.color.copy(color);
  refs.flaskSurface.material.emissive.copy(color).multiplyScalar(0.2);
}

function animateStir(refs, dt) {
  refs.flaskLiquid.rotateOnAxis(_stirAxis, 0.15 * dt);
}

/* =========================================================
   Drop system
   ========================================================= */
const _dropGeom = new THREE.SphereGeometry(0.04, 16, 16);
const _dropMat  = new THREE.MeshStandardMaterial({
  color: 0x00d9ff, metalness: 0.2, roughness: 0.3,
  transparent: true, opacity: 0.85,
  emissive: 0x00aaff, emissiveIntensity: 0.5,
});
const _drops = [];

function spawnDrop(scene, tipPosition) {
  const d = new THREE.Mesh(_dropGeom, _dropMat.clone());
  d.position.set(tipPosition.x, tipPosition.y - 0.08, tipPosition.z);
  d.userData.vy   = -1.2 - Math.random() * 0.3;
  d.userData.life = 2.5;
  d.castShadow    = true;
  scene.add(d);
  _drops.push(d);
}

function updateDrops(scene, dt, flaskBaseY) {
  for (let i = _drops.length - 1; i >= 0; i--) {
    const d = _drops[i];
    d.userData.life -= dt;
    d.position.y    += d.userData.vy * dt;
    d.userData.vy   -= 3.0 * dt;
    if (d.position.y < flaskBaseY + 0.3 || d.userData.life <= 0) {
      scene.remove(d);
      _drops.splice(i, 1);
    }
  }
}

/* =========================================================
   Window resize
   ========================================================= */
function onWindowResize(refs) {
  refs.camera.aspect = window.innerWidth / window.innerHeight;
  refs.camera.updateProjectionMatrix();
  refs.renderer.setSize(window.innerWidth, window.innerHeight);
  refs.controls.update();
}

/* =========================================================
   Private helpers
   ========================================================= */
function _clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

function _addStand(scene) {
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x8b9dc3, metalness: 0.9, roughness: 0.1 });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.3 }),
  );
  base.position.set(-1, 0.04, 0);
  base.castShadow = true;
  scene.add(base);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 4.0, 24), metalMat);
  rod.position.set(-1, 2.0, 0);
  rod.castShadow = true;
  scene.add(rod);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 24), metalMat.clone());
  arm.rotation.z = Math.PI / 2;
  arm.position.set(-0.6, 3.2, 0);
  scene.add(arm);

  const clampMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.4, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.4, roughness: 0.5 }),
  );
  clampMesh.position.set(-0.2, 3.2, 0);
  clampMesh.castShadow = true;
  scene.add(clampMesh);
}
