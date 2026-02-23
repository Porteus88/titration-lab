/**
 * curve.js
 * Manages the 2-D titration curve drawn on a <canvas> element.
 * No Three.js dependency.
 */

'use strict';

const curve = {
  points:        [],
  padding:       40,
  yMin:          0,
  yMax:          14,
  selectedIndex: null,
};

/* =========================================================
   Public API
   ========================================================= */

function resetCurve() {
  curve.points        = [];
  curve.selectedIndex = null;
  drawCurve();
}

function addCurvePoint(x, pH) {
  curve.points.push({ x, y: pH });
  drawCurve();
}

function drawCurve() {
  const canvas = document.getElementById('curveCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Resize backing store if needed
  const targetW = Math.floor(rect.width  * dpr);
  const targetH = Math.floor(rect.height * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width  = targetW;
    canvas.height = targetH;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const w   = rect.width;
  const h   = rect.height;
  const pad = curve.padding;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const xMax   = _curveXMax();
  const innerW = w - 2 * pad;
  const innerH = h - 2 * pad;
  const xToPx  = x => pad + (x / xMax) * innerW;
  const yToPx  = y => h - pad - ((y - curve.yMin) / (curve.yMax - curve.yMin)) * innerH;

  // ---- Grid ----
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth   = 1;

  for (let y = 0; y <= 14; y += 2) {
    ctx.beginPath();
    ctx.moveTo(pad, yToPx(y));
    ctx.lineTo(w - pad, yToPx(y));
    ctx.stroke();
  }
  for (let x = 0; x <= xMax; x += 5) {
    ctx.beginPath();
    ctx.moveTo(xToPx(x), h - pad);
    ctx.lineTo(xToPx(x), pad);
    ctx.stroke();
  }

  // ---- Axes ----
  ctx.strokeStyle = '#475569';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  // ---- Axis labels ----
  ctx.fillStyle = '#0f172a';
  ctx.font      = '600 13px system-ui';
  ctx.textAlign = 'right';
  for (let y = 0; y <= 14; y += 2) {
    ctx.fillText(String(y), pad - 6, yToPx(y) + 5);
  }
  ctx.textAlign = 'center';
  for (let x = 0; x <= xMax; x += 5) {
    ctx.fillText(String(x), xToPx(x), h - pad + 20);
  }

  // ---- Curve ----
  if (curve.points.length > 1) {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth   = 3;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(xToPx(curve.points[0].x), yToPx(curve.points[0].y));
    for (let i = 1; i < curve.points.length; i++) {
      ctx.lineTo(xToPx(curve.points[i].x), yToPx(curve.points[i].y));
    }
    ctx.stroke();

    // Data-point dots
    ctx.fillStyle = '#7c3aed';
    for (const p of curve.points) {
      ctx.beginPath();
      ctx.arc(xToPx(p.x), yToPx(p.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Equivalence point markers ----
  if (window.appState && window.appState.equivalencePoints) {
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth   = 2;
    ctx.fillStyle   = '#f59e0b';
    ctx.font        = '600 12px system-ui';
    ctx.textAlign   = 'left';
    for (const pt of window.appState.equivalencePoints) {
      const px = xToPx(pt.volume);
      ctx.beginPath();
      ctx.moveTo(px, h - pad);
      ctx.lineTo(px, pad);
      ctx.stroke();
      ctx.fillText(pt.label, px + 5, pad + 20);
    }
    ctx.setLineDash([]);
  }

  // ---- Selection overlay ----
  if (curve.selectedIndex !== null && curve.points[curve.selectedIndex]) {
    const sp = curve.points[curve.selectedIndex];
    const px = xToPx(sp.x);
    const py = yToPx(sp.y);

    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(px, pad);
    ctx.lineTo(px, h - pad);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Axis titles ----
  ctx.fillStyle = '#0f172a';
  ctx.font      = '600 14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('mL titrant added', w / 2, h - 4);
  ctx.save();
  ctx.translate(16, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('pH', 0, 0);
  ctx.restore();
}

/* =========================================================
   Interaction
   ========================================================= */

function handleCurveClick(ev) {
  const canvas = document.getElementById('curveCanvas');
  const rect   = canvas.getBoundingClientRect();
  const pad    = curve.padding;
  const xMax   = _curveXMax();
  const innerW = rect.width - 2 * pad;
  const rawX   = (ev.clientX - rect.left - pad) / innerW * xMax;
  const x      = Math.min(Math.max(rawX, 0), xMax);

  curve.selectedIndex = _nearestIndexByX(curve.points, x);
  _updateSelInfo();
  drawCurve();
}

function exportCSV() {
  if (curve.points.length === 0) {
    alert('No data to export. Please run a titration first.');
    return;
  }
  const rows = ['Volume Added (mL),pH',
    ...curve.points.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `titration_data_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function detectEquivalencePoint() {
  if (curve.points.length < 10) {
    alert('Not enough data points. Add more titrant first.');
    return;
  }
  let maxDeriv = 0;
  let eqIdx    = 0;
  for (let i = 1; i < curve.points.length - 1; i++) {
    const dy = curve.points[i + 1].y - curve.points[i - 1].y;
    const dx = curve.points[i + 1].x - curve.points[i - 1].x;
    const d  = Math.abs(dx > 0 ? dy / dx : 0);
    if (d > maxDeriv) { maxDeriv = d; eqIdx = i; }
  }
  curve.selectedIndex = eqIdx;
  _updateSelInfo();
  drawCurve();
  const pt = curve.points[eqIdx];
  alert(`Equivalence point detected:\nVolume: ${pt.x.toFixed(2)} mL\npH: ${pt.y.toFixed(2)}`);
}

function copySelectedPoint() {
  if (curve.selectedIndex === null) return;
  const p   = curve.points[curve.selectedIndex];
  const txt = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  if (navigator.clipboard) navigator.clipboard.writeText(txt);
}

function clearSelection() {
  curve.selectedIndex = null;
  _updateSelInfo();
  drawCurve();
}

/* =========================================================
   Private helpers
   ========================================================= */

function _curveXMax() {
  if (!window.appState) return 60;
  const { analyteConc, analyteVol, titrantConc, titrantMax, titrantVol } = window.appState;
  const nA      = analyteConc * (analyteVol / 1000);
  const veq     = titrantConc > 0 ? (nA / titrantConc) * 1000 : 25;
  const target  = Math.max(titrantMax, veq * 1.3, titrantVol + 5);
  return Math.max(20, Math.ceil(target / 5) * 5);
}

function _nearestIndexByX(points, x) {
  if (!points || points.length === 0) return null;
  let best = 0, bestD = Math.abs(points[0].x - x);
  for (let i = 1; i < points.length; i++) {
    const d = Math.abs(points[i].x - x);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function _updateSelInfo() {
  const el = document.getElementById('selInfo');
  if (!el) return;
  if (curve.selectedIndex === null || !curve.points[curve.selectedIndex]) {
    el.textContent = 'None';
    return;
  }
  const p = curve.points[curve.selectedIndex];
  el.textContent = `${p.x.toFixed(2)} mL, pH ${p.y.toFixed(2)}`;
}
