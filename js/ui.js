/**
 * ui.js
 * DOM readout updates and panel synchronisation.
 * Depends on: chemistry.js, indicators.js
 */

'use strict';

/* =========================================================
   Label sync (called when titration type changes)
   ========================================================= */

function updateLabels(state) {
  const t = state.type;
  const pKaRow  = document.getElementById('pKaRow');
  const pKa2Row = document.getElementById('pKa2Row');
  const pKa3Row = document.getElementById('pKa3Row');
  const pKbRow  = document.getElementById('pKbRow');

  const show = el => el && (el.style.display = 'grid');
  const hide = el => el && (el.style.display = 'none');

  // Defaults – hide everything, then re-show as needed
  [pKaRow, pKa2Row, pKa3Row, pKbRow].forEach(hide);

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  if (t === 'strong_base_strong_acid') {
    set('analyteLbl',    'Acid conc. (M) [flask]');
    set('titrantLbl',    'Base conc. (M) [burette]');
    set('analyteVolLbl', 'Acid volume (mL) [flask]');
  } else if (t === 'strong_acid_strong_base') {
    set('analyteLbl',    'Base conc. (M) [flask]');
    set('titrantLbl',    'Acid conc. (M) [burette]');
    set('analyteVolLbl', 'Base volume (mL) [flask]');
  } else if (t === 'strong_base_weak_acid') {
    set('analyteLbl',    'Weak acid conc. (M) [flask]');
    set('titrantLbl',    'Strong base conc. (M) [burette]');
    set('analyteVolLbl', 'Acid volume (mL) [flask]');
    set('pKaLbl',        'pKa of weak acid (e.g., 4.74)');
    show(pKaRow);
  } else if (t === 'strong_acid_weak_base') {
    set('analyteLbl',    'Weak base conc. (M) [flask]');
    set('titrantLbl',    'Strong acid conc. (M) [burette]');
    set('analyteVolLbl', 'Base volume (mL) [flask]');
    set('pKaLbl',        'pKb of weak base (e.g., 4.74)');
    show(pKaRow);
  } else if (t === 'weak_acid_weak_base') {
    set('analyteLbl',    'Weak base conc. (M) [flask]');
    set('titrantLbl',    'Weak acid conc. (M) [burette]');
    set('analyteVolLbl', 'Base volume (mL) [flask]');
    set('pKaLbl',        'pKa of weak acid [burette]');
    set('pKbLbl',        'pKb of weak base [flask]');
    show(pKaRow);
    show(pKbRow);
  } else if (t === 'strong_base_diprotic_acid') {
    set('analyteLbl',    'Diprotic acid conc. (M) [flask]');
    set('titrantLbl',    'Strong base conc. (M) [burette]');
    set('analyteVolLbl', 'Acid volume (mL) [flask]');
    set('pKaLbl',        'pKa1 (e.g., H₂SO₄: 1.99)');
    set('pKa2Lbl',       'pKa2 (e.g., H₂SO₄: 7.20)');
    show(pKaRow);
    show(pKa2Row);
  } else if (t === 'strong_base_triprotic_acid') {
    set('analyteLbl',    'Triprotic acid conc. (M) [flask]');
    set('titrantLbl',    'Strong base conc. (M) [burette]');
    set('analyteVolLbl', 'Acid volume (mL) [flask]');
    set('pKaLbl',        'pKa1 (e.g., H₃PO₄: 2.15)');
    set('pKa2Lbl',       'pKa2 (e.g., H₃PO₄: 7.20)');
    set('pKa3Lbl',       'pKa3 (e.g., H₃PO₄: 12.35)');
    show(pKaRow);
    show(pKa2Row);
    show(pKa3Row);
  }
}

/* =========================================================
   Main readout refresh
   ========================================================= */

function updateReadouts(state) {
  const pH = calcPH(state);
  state.targetPH = pH;

  _setText('vbOut',   state.titrantVol.toFixed(2));
  _setText('vtOut',   (state.analyteVol + state.titrantVol).toFixed(2));

  document.getElementById('phDigits').textContent = pH.toFixed(2);
  document.getElementById('phBar').style.width    = `${(pH / 14) * 100}%`;

  _updateChemDetails(state, pH);
  _updateEquivalenceUI(state);
}

/* =========================================================
   Indicator UI
   ========================================================= */

function updateIndicatorUI(state) {
  const ind = INDICATOR_DATABASE[state.selectedIndicator] || INDICATOR_DATABASE.bromothymol_blue;

  let rangeStr;
  if (ind.transitions.length > 1) {
    rangeStr = 'pH ' + ind.transitions.map(t => `${t.low.toFixed(1)}–${t.high.toFixed(1)}`).join(', ');
  } else {
    rangeStr = `pH ${ind.lowPH.toFixed(1)}–${ind.highPH.toFixed(1)}`;
  }
  _setText('indicatorInfo', `Indicator: ${ind.name} (${rangeStr})`);

  const bar = document.getElementById('indicatorBar');
  if (bar) bar.style.background = ind.gradient;
}

/**
 * Move the indicator marker needle to the current display pH.
 */
function updateIndicatorMarker(displayPH) {
  const marker = document.getElementById('indicatorMarker');
  if (marker) marker.style.left = ((displayPH / 14) * 100).toFixed(2) + '%';
}

/* =========================================================
   Private helpers
   ========================================================= */

function _setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function _updateEquivalenceUI(state) {
  const nA    = state.analyteConc * (state.analyteVol / 1000);
  const Veq   = state.titrantConc > 0 ? (nA / state.titrantConc) * 1000 : 0;
  _setText('veqOut', Veq.toFixed(2));

  state.equivalencePoints = calcEquivalencePoints(state);

  const pts = state.equivalencePoints;
  if (pts.length > 1) {
    _setText('eqPointsOut', pts.map(p => `${p.label}: ${p.volume.toFixed(2)}`).join(', '));
  } else if (pts.length === 1) {
    _setText('eqPointsOut', `${pts[0].volume.toFixed(2)} mL`);
  }
}

function _updateChemDetails(state, pH) {
  const pOH   = 14 - pH;
  const H_c   = 10 ** -pH;
  const OH_c  = 10 ** -pOH;

  _setText('pOHOut',   pOH.toFixed(2));
  _setText('hConcOut',  formatSci(H_c)  + ' M');
  _setText('ohConcOut', formatSci(OH_c) + ' M');

  const showKa = state.type.includes('weak_acid') || state.type.includes('diprotic') || state.type.includes('triprotic');
  const showKb = state.type.includes('weak_base');

  const kaDisplay = document.getElementById('kaLabel');
  const kbDisplay = document.getElementById('kbLabel');
  const kaOut     = document.getElementById('kaOut');
  const kbOut     = document.getElementById('kbOut');

  if (kaDisplay) kaDisplay.parentElement && (kaDisplay.closest('[id^="ka"]') || { style: {} });
  if (kaOut) {
    kaOut.textContent = showKa ? formatSci(10 ** -state.pKa) : '—';
  }
  if (kbOut) {
    kbOut.textContent = showKb ? formatSci(10 ** -state.pKb) : '—';
  }

  // Percent neutralization
  const nA  = state.analyteConc * (state.analyteVol / 1000);
  const nT  = state.titrantConc * (state.titrantVol / 1000);
  const den = state.type.includes('triprotic') ? 3 * nA
            : state.type.includes('diprotic')  ? 2 * nA
            : nA;
  const pct = den > 0 ? Math.min(100, (nT / den) * 100) : 0;
  _setText('percentNeut', pct.toFixed(1) + '%');
}
