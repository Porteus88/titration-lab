/**
 * chemistry.js
 * Pure pH calculation logic for all supported titration types.
 * No DOM or Three.js dependencies.
 */

'use strict';

const Kw  = 1e-14;
const EPS = 1e-12;

/**
 * Clamp a value between lo and hi.
 * (Duplicated here so this module can stand alone in unit tests.)
 */
function clampPH(x, lo = 0, hi = 14) {
  return Math.min(Math.max(x, lo), hi);
}

/**
 * Solve ax² + bx + c = 0, returning the positive root (chemistry context).
 */
function posQuadRoot(a, b, c) {
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  return (-b + Math.sqrt(disc)) / (2 * a);
}

/**
 * Calculate pH for the given titration state.
 *
 * @param {object} p
 * @param {string} p.type         - Titration type key
 * @param {number} p.analyteConc  - M
 * @param {number} p.analyteVol   - mL
 * @param {number} p.titrantConc  - M
 * @param {number} p.titrantVol   - mL
 * @param {number} p.pKa          - pKa of weak acid (or pKb for strong_acid_weak_base)
 * @param {number} p.pKb          - pKb of weak base
 * @param {number} p.pKa2         - 2nd ionization pKa (diprotic/triprotic)
 * @param {number} p.pKa3         - 3rd ionization pKa (triprotic)
 * @returns {number} pH 0–14
 */
function calcPH({ type, analyteConc, analyteVol, titrantConc, titrantVol, pKa, pKb, pKa2, pKa3 }) {
  const Vt_L    = (analyteVol + titrantVol) / 1000;
  if (Vt_L <= 0) return 7.00;

  const nA = analyteConc * (analyteVol / 1000);   // moles analyte
  const nT = titrantConc * (titrantVol / 1000);   // moles titrant

  switch (type) {
    case 'strong_base_strong_acid': return _strongBaseStrongAcid(nA, nT, Vt_L);
    case 'strong_acid_strong_base': return _strongAcidStrongBase(nA, nT, Vt_L);
    case 'strong_base_weak_acid':   return _strongBaseWeakAcid(nA, nT, Vt_L, pKa);
    case 'strong_acid_weak_base':   return _strongAcidWeakBase(nA, nT, Vt_L, pKb);
    case 'weak_acid_weak_base':     return _weakAcidWeakBase(nA, nT, Vt_L, pKa, pKb);
    case 'strong_base_diprotic_acid':  return _strongBaseDiproticAcid(nA, nT, Vt_L, pKa, pKa2);
    case 'strong_base_triprotic_acid': return _strongBaseTriproticAcid(nA, nT, Vt_L, pKa, pKa2, pKa3);
    default: return 7.00;
  }
}

// ---- Private helpers ----

function _strongBaseStrongAcid(nAcid, nBase, Vt_L) {
  const diff = nAcid - nBase;
  if (Math.abs(diff) <= 1e-10) return 7.00;
  if (diff > 0) return clampPH(-Math.log10(diff / Vt_L));
  return clampPH(14 + Math.log10(-diff / Vt_L));
}

function _strongAcidStrongBase(nBase, nAcid, Vt_L) {
  const diff = nBase - nAcid;
  if (Math.abs(diff) <= 1e-10) return 7.00;
  if (diff > 0) return clampPH(14 + Math.log10(diff / Vt_L));
  return clampPH(-Math.log10(-diff / Vt_L));
}

function _strongBaseWeakAcid(nHA, nOH, Vt_L, pKa) {
  const Ka = 10 ** -pKa;

  if (nOH < EPS) {
    // Initial weak acid
    const C = nHA / Vt_L;
    const H = posQuadRoot(1, Ka, -Ka * C);
    return clampPH(-Math.log10(H));
  }

  if (nOH + EPS < nHA) {
    // Buffer region (Henderson-Hasselbalch)
    const nConj = nOH;
    const nAcid = nHA - nOH;
    return clampPH(pKa + Math.log10((nConj || EPS) / (nAcid || EPS)));
  }

  if (Math.abs(nOH - nHA) <= 1e-10) {
    // Equivalence: conjugate base hydrolysis
    const C  = nHA / Vt_L;
    const Kb = Kw / Ka;
    const OH = posQuadRoot(1, Kb, -Kb * C);
    return clampPH(14 + Math.log10(OH));
  }

  // Excess strong base
  const excess = nOH - nHA;
  return clampPH(14 + Math.log10(excess / Vt_L));
}

function _strongAcidWeakBase(nBase, nAcid, Vt_L, pKb) {
  const Kb = 10 ** -pKb;
  const Ka = Kw / Kb;

  if (nAcid < EPS) {
    // Initial weak base
    const C  = nBase / Vt_L;
    const OH = posQuadRoot(1, Kb, -Kb * C);
    return clampPH(14 + Math.log10(OH));
  }

  if (nAcid + EPS < nBase) {
    // Buffer region
    const nB   = nBase - nAcid;
    const nBH  = nAcid;
    const pOH  = pKb + Math.log10((nB || EPS) / (nBH || EPS));
    return clampPH(14 - pOH);
  }

  if (Math.abs(nAcid - nBase) <= 1e-10) {
    // Equivalence: conjugate acid hydrolysis
    const C = nBase / Vt_L;
    const H = posQuadRoot(1, Ka, -Ka * C);
    return clampPH(-Math.log10(H));
  }

  // Excess strong acid
  const excess = nAcid - nBase;
  return clampPH(-Math.log10(excess / Vt_L));
}

function _weakAcidWeakBase(nBase, nAcid, Vt_L, pKa, pKb) {
  // nBase = analyte (weak base in flask), nAcid = titrant (weak acid from burette)
  if (nAcid < EPS) {
    const Kb = 10 ** -pKb;
    const C  = nBase / Vt_L;
    const OH = posQuadRoot(1, Kb, -Kb * C);
    return clampPH(14 + Math.log10(OH));
  }

  if (nAcid + EPS < nBase) {
    const nB  = nBase - nAcid;
    const nBH = nAcid;
    const pOH = pKb + Math.log10((nB || EPS) / (nBH || EPS));
    return clampPH(14 - pOH);
  }

  if (Math.abs(nAcid - nBase) <= 1e-10) {
    // Equivalence: determined by relative strengths
    return clampPH(7 + 0.5 * (pKa - pKb));
  }

  // Excess weak acid
  const nA_excess = nAcid - nBase;
  const nConjBase = nBase;
  return clampPH(pKa + Math.log10((nConjBase || EPS) / (nA_excess || EPS)));
}

function _strongBaseDiproticAcid(nH2A, nOH, Vt_L, pKa1, pKa2) {
  const Ka1 = 10 ** -pKa1;
  const Ka2 = 10 ** -pKa2;
  const Veq1 = nH2A;
  const Veq2 = 2 * nH2A;

  if (nOH < EPS) {
    const C = nH2A / Vt_L;
    return clampPH(-Math.log10(Math.sqrt(Ka1 * C)));
  }

  if (nOH + EPS < Veq1) {
    const nHA  = nOH;
    const nH2A_rem = nH2A - nOH;
    return clampPH(pKa1 + Math.log10((nHA || EPS) / (nH2A_rem || EPS)));
  }

  if (Math.abs(nOH - Veq1) < 1e-10) {
    return clampPH((pKa1 + pKa2) / 2);   // Amphiprotic species
  }

  if (nOH + EPS < Veq2) {
    const nA2  = nOH - Veq1;
    const nHA  = Veq1 - (nOH - Veq1);
    return clampPH(pKa2 + Math.log10((nA2 || EPS) / (nHA || EPS)));
  }

  if (Math.abs(nOH - Veq2) < 1e-10) {
    const C  = nH2A / Vt_L;
    const Kb = Kw / Ka2;
    const OH = Math.sqrt(Kb * C);
    return clampPH(14 + Math.log10(OH));
  }

  const excess = nOH - Veq2;
  return clampPH(14 + Math.log10(excess / Vt_L));
}

function _strongBaseTriproticAcid(nH3A, nOH, Vt_L, pKa1, pKa2, pKa3) {
  const Ka3 = 10 ** -pKa3;
  const Veq1 = nH3A;
  const Veq2 = 2 * nH3A;
  const Veq3 = 3 * nH3A;

  if (nOH < EPS) {
    const C = nH3A / Vt_L;
    return clampPH(-Math.log10(Math.sqrt((10 ** -pKa1) * C)));
  }

  if (nOH + EPS < Veq1) {
    const nH2A = nOH;
    const nH3A_rem = nH3A - nOH;
    return clampPH(pKa1 + Math.log10((nH2A || EPS) / (nH3A_rem || EPS)));
  }

  if (Math.abs(nOH - Veq1) < 1e-10) return clampPH((pKa1 + pKa2) / 2);

  if (nOH + EPS < Veq2) {
    const nHA2 = nOH - Veq1;
    const nH2A = Veq1 - (nOH - Veq1);
    return clampPH(pKa2 + Math.log10((nHA2 || EPS) / (nH2A || EPS)));
  }

  if (Math.abs(nOH - Veq2) < 1e-10) return clampPH((pKa2 + pKa3) / 2);

  if (nOH + EPS < Veq3) {
    const nA3  = nOH - Veq2;
    const nHA2 = Veq2 - (nOH - Veq2);
    return clampPH(pKa3 + Math.log10((nA3 || EPS) / (nHA2 || EPS)));
  }

  if (Math.abs(nOH - Veq3) < 1e-10) {
    const C  = nH3A / Vt_L;
    const Kb = Kw / Ka3;
    const OH = Math.sqrt(Kb * C);
    return clampPH(14 + Math.log10(OH));
  }

  const excess = nOH - Veq3;
  return clampPH(14 + Math.log10(excess / Vt_L));
}

/**
 * Calculate all equivalence point volumes (mL) for the given state.
 * @param {object} state
 * @returns {Array<{volume: number, label: string}>}
 */
function calcEquivalencePoints(state) {
  const nA = state.analyteConc * (state.analyteVol / 1000);
  if (state.titrantConc <= 0) return [];

  const toML = n => (n / state.titrantConc) * 1000;

  if (state.type === 'strong_base_diprotic_acid') {
    return [
      { volume: toML(nA),     label: '1st Eq' },
      { volume: toML(2 * nA), label: '2nd Eq' },
    ];
  }

  if (state.type === 'strong_base_triprotic_acid') {
    return [
      { volume: toML(nA),     label: '1st Eq' },
      { volume: toML(2 * nA), label: '2nd Eq' },
      { volume: toML(3 * nA), label: '3rd Eq' },
    ];
  }

  return [{ volume: toML(nA), label: 'Eq' }];
}

/**
 * Format a number in scientific notation using Unicode superscripts.
 */
function formatSci(value) {
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(value));
  const mant = value / 10 ** exp;
  const sup = (exp < 0 ? '⁻' : '⁺') + String(Math.abs(exp))
    .split('')
    .map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d])
    .join('');
  return `${mant.toFixed(2)}×10${sup}`;
}
