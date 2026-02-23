/**
 * main.js
 * Application entry point.
 * Wires state, event handlers, animation loop, and all modules together.
 */

'use strict';

/* =========================================================
   Application State
   (exposed as window.appState so curve.js can read xMax)
   ========================================================= */
const appState = {
  // Titration config
  type:        'strong_base_strong_acid',
  analyteConc: 0.100,
  analyteVol:  25.00,
  titrantConc: 0.100,
  titrantVol:  0.00,
  titrantMax:  50.00,
  pKa:         4.74,
  pKa2:        7.20,
  pKa3:        12.35,
  pKb:         4.74,

  // Indicator
  selectedIndicator: 'bromothymol_blue',

  // Derived / runtime
  equivalencePoints: [],
  dripOn:     false,
  dps:        0,
  dropVolume: 0.050,
  targetPH:   7.00,
  displayPH:  7.00,
  mixTau:     1.0,
};

window.appState = appState;   // Expose for curve.js _curveXMax()

/* =========================================================
   Build Three.js scene
   ========================================================= */
const sceneCanvas = document.getElementById('scene');
const refs        = buildScene(sceneCanvas);

/* =========================================================
   Helpers
   ========================================================= */
function readStateFromUI() {
  appState.type             = document.getElementById('titrationType').value;
  appState.selectedIndicator = document.getElementById('indicatorSelect').value;
  appState.analyteConc      = Math.max(0, parseFloat(document.getElementById('analyteConcSel').value) || 0);
  appState.titrantConc      = Math.max(0, parseFloat(document.getElementById('titrantConcSel').value) || 0);
  appState.analyteVol       = Math.max(0, parseFloat(document.getElementById('analyteVol').value)     || 0);
  appState.pKa              = Math.max(0, parseFloat(document.getElementById('pKaInput').value)        || 4.74);
  appState.pKa2             = Math.max(0, parseFloat(document.getElementById('pKa2Input').value)       || 7.20);
  appState.pKa3             = Math.max(0, parseFloat(document.getElementById('pKa3Input').value)       || 12.35);
  appState.pKb              = Math.max(0, parseFloat(document.getElementById('pKbInput').value)        || 4.74);
  appState.dps              = Math.max(0, parseFloat(document.getElementById('dps').value)             || 0);
}

/** Full re-initialise (used on param change or reset). */
function refreshAll() {
  readStateFromUI();
  updateLabels(appState);
  updateIndicatorUI(appState);
  updateReadouts(appState);
  resetCurve();

  const pH0 = calcPH(appState);
  appState.displayPH = pH0;
  appState.targetPH  = pH0;
  addCurvePoint(appState.titrantVol, pH0);
}

/** Add a specific volume (mL) of titrant. */
function addVolume(mL) {
  const space = Math.max(0, appState.titrantMax - appState.titrantVol);
  const add   = Math.min(space, Math.max(0, mL));
  if (add <= 0) return;

  appState.titrantVol += add;
  const pH = calcPH(appState);
  addCurvePoint(appState.titrantVol, pH);
  spawnDrop(refs.scene, refs.tip.position);
  updateReadouts(appState);
}

const addDrop  = ()  => addVolume(appState.dropVolume);
const addNDrops = n  => { for (let i = 0; i < n; i++) addDrop(); };

function setDrip(on) {
  appState.dripOn = !!on;
  if (appState.dripOn && appState.dps <= 0) {
    appState.dps = 2;
    document.getElementById('dps').value = '2';
  }
  document.getElementById('toggleDrip').textContent = appState.dripOn ? 'Pause drip' : 'Start drip';
}

function goToHalfEq() {
  const nA   = appState.analyteConc * (appState.analyteVol / 1000);
  const Vhalf = ((nA / (appState.titrantConc || 1e-9)) * 1000) / 2;
  appState.titrantVol = Math.min(Math.max(Vhalf, 0), appState.titrantMax);
  updateReadouts(appState);
}

/* =========================================================
   Event listeners
   ========================================================= */
const paramIds = [
  'titrationType', 'analyteConcSel', 'titrantConcSel',
  'analyteVol', 'pKaInput', 'pKa2Input', 'pKa3Input', 'pKbInput',
];

paramIds.forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', () => {
    if (id === 'titrationType') {
      // Auto-suggest indicator
      const best = getDefaultIndicator(appState.type);
      document.getElementById('indicatorSelect').value = best;
      appState.selectedIndicator = best;
    }
    refreshAll();
  });
});

document.getElementById('indicatorSelect').addEventListener('change', refreshAll);

document.getElementById('dps').addEventListener('input', () => {
  appState.dps = parseFloat(document.getElementById('dps').value) || 0;
});

document.getElementById('toggleDrip').addEventListener('click', () => setDrip(!appState.dripOn));
document.getElementById('oneDrop').addEventListener('click',   () => addDrop());
document.getElementById('fiveDrops').addEventListener('click', () => addNDrops(5));
document.getElementById('tenDrops').addEventListener('click',  () => addNDrops(10));
document.getElementById('halfEq').addEventListener('click',    goToHalfEq);

document.getElementById('resetBtn').addEventListener('click', () => {
  appState.titrantVol = 0;
  appState.dripOn     = false;
  document.getElementById('dps').value = '0';
  appState.dps = 0;
  document.getElementById('toggleDrip').textContent = 'Start drip';
  refreshAll();
});

document.getElementById('exportData').addEventListener('click',    exportCSV);
document.getElementById('detectEqPoint').addEventListener('click', detectEquivalencePoint);
document.getElementById('curveCanvas').addEventListener('click',   handleCurveClick);
document.getElementById('copyPoint').addEventListener('click',     copySelectedPoint);
document.getElementById('clearSel').addEventListener('click',      clearSelection);

window.addEventListener('resize', () => {
  onWindowResize(refs);
  drawCurve();
});

/* =========================================================
   Animation loop
   ========================================================= */
let   _last          = performance.now();
let   _dropAccum     = 0;

function tick() {
  const now = performance.now();
  const dt  = Math.min((now - _last) / 1000, 0.1);   // cap at 100 ms
  _last     = now;

  // Auto-drip
  if (appState.dripOn && appState.dps > 0) {
    _dropAccum += dt * appState.dps;
    while (_dropAccum >= 1) {
      addDrop();
      _dropAccum -= 1;
    }
  }

  // Smooth pH display
  if (!isFinite(appState.displayPH)) appState.displayPH = appState.targetPH;
  const alpha = 1 - Math.exp(-dt / Math.max(0.0001, appState.mixTau));
  appState.displayPH += (appState.targetPH - appState.displayPH) * alpha;

  // Apply indicator colour to flask
  const col = indicatorColor(appState.selectedIndicator, appState.displayPH);
  applyFlaskColor(refs, col);

  // Indicator bar needle
  updateIndicatorMarker(appState.displayPH);

  // 3D object updates
  updateScene3D(refs, appState);
  animateStir(refs, dt);
  updateDrops(refs.scene, dt, refs.flaskGlass.position.y);

  refs.controls.update();
  refs.renderer.render(refs.scene, refs.camera);
  requestAnimationFrame(tick);
}

/* =========================================================
   Bootstrap
   ========================================================= */
refreshAll();
tick();
