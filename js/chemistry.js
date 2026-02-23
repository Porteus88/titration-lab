/**
 * chemistry.js
 * Pure pH calculation logic for all supported titration types.
 * No DOM or Three.js dependencies.
 */

'use strict';

const Kw  = 1e-14;
const EPS = 1e-12;

/**
 * Fraction of equivalence point used as the smooth-transition half-width.
 * Wide enough to always catch discrete drops, narrow enough to look correct.
 */
const EQ_ZONE = 0.005; // 0.5% of eq volume either side

function clampPH(x, lo = 0, hi = 14) {
  return Math.min(Math.max(x, lo), hi);
}

function posQuadRoot(a, b, c) {
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  return (-b + Math.sqrt(disc)) / (2 * a);
}

/**
 * Calculate pH for the given titration state.
 *
 * @param {object} p
 * @param {string} p.type
 * @param {number} p.analyteConc  - M
 * @param {number} p.analyteVol   - mL
 * @param {number} p.titrantConc  - M
 * @param {number} p.titrantVol   - mL
 * @param {number} p.pKa          - pKa of weak acid
 * @param {number} p.pKb          - pKb of weak base
 * @param {number} p.pKa2         - 2nd ionization pKa
 * @param {number} p.pKa3         - 3rd ionization pKa
 * @returns {number} pH 0–14
 */
function calcPH({ type, analyteConc, analyteVol, titrantConc, titrantVol, pKa, pKb, pKa2, pKa3 }) {
  const Vt_L = (analyteVol + titrantVol) / 1000;
  if (Vt_L <= 0) return 7.00;

  const nA = analyteConc * (analyteVol / 1000);
  const nT = titrantConc * (titrantVol / 1000);

  switch (type) {
    case 'strong_base_strong_acid':    return _strongBaseStrongAcid(nA, nT, Vt_L);
    case 'strong_acid_strong_base':    return _strongAcidStrongBase(nA, nT, Vt_L);
    case 'strong_base_weak_acid':      return _strongBaseWeakAcid(nA, nT, Vt_L, pKa);
    case 'strong_acid_weak_base':      return _strongAcidWeakBase(nA, nT, Vt_L, pKb);
    case 'weak_acid_weak_base':        return _weakAcidWeakBase(nA, nT, Vt_L, pKa, pKb);
    case 'strong_base_diprotic_acid':  return _strongBaseDiproticAcid(nA, nT, Vt_L, pKa, pKa2);
    case 'strong_base_triprotic_acid': return _strongBaseTriproticAcid(nA, nT, Vt_L, pKa, pKa2, pKa3);
    default: return 7.00;
  }
}

// ---- Strong/Strong ----

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

// ---- Strong Base + Weak Acid ----

function _strongBaseWeakAcid(nHA, nOH, Vt_L, pKa) {
  const Ka = 10 ** -pKa;
  const delta = nHA * EQ_ZONE;

  if (nOH < EPS) {
    const C = nHA / Vt_L;
    const H = posQuadRoot(1, Ka, -Ka * C);
    return clampPH(-Math.log10(H));
  }

  if (nOH < nHA - delta) {
    // Buffer region
    const ratio = nOH / (nHA - nOH);
    return clampPH(pKa + Math.log10(ratio));
  }

  if (nOH <= nHA + delta) {
    // Equivalence zone: conjugate base hydrolysis
    const C  = nHA / Vt_L;
    const Kb = Kw / Ka;
    const OH = posQuadRoot(1, Kb, -Kb * C);
    return clampPH(14 + Math.log10(Math.max(OH, EPS)));
  }

  // Excess strong base
  return clampPH(14 + Math.log10((nOH - nHA) / Vt_L));
}

// ---- Strong Acid + Weak Base ----

function _strongAcidWeakBase(nBase, nAcid, Vt_L, pKb) {
  const Kb = 10 ** -pKb;
  const Ka = Kw / Kb;
  const delta = nBase * EQ_ZONE;

  if (nAcid < EPS) {
    const C  = nBase / Vt_L;
    const OH = posQuadRoot(1, Kb, -Kb * C);
    return clampPH(14 + Math.log10(Math.max(OH, EPS)));
  }

  if (nAcid < nBase - delta) {
    // Buffer region
    const ratio = (nBase - nAcid) / nAcid;
    const pOH   = pKb + Math.log10(ratio);
    return clampPH(14 - pOH);
  }

  if (nAcid <= nBase + delta) {
    // Equivalence zone: conjugate acid hydrolysis
    const C = nBase / Vt_L;
    const H = posQuadRoot(1, Ka, -Ka * C);
    return clampPH(-Math.log10(Math.max(H, EPS)));
  }

  // Excess strong acid
  return clampPH(-Math.log10((nAcid - nBase) / Vt_L));
}

// ---- Weak Acid + Weak Base ----

function _weakAcidWeakBase(nBase, nAcid, Vt_L, pKa, pKb) {
  const Kb    = 10 ** -pKb;
  const delta = nBase * EQ_ZONE;

  if (nAcid < EPS) {
    const C  = nBase / Vt_L;
    const OH = posQuadRoot(1, Kb, -Kb * C);
    return clampPH(14 + Math.log10(Math.max(OH, EPS)));
  }

  if (nAcid < nBase - delta) {
    // Buffer: B + BH+
    const ratio = (nBase - nAcid) / nAcid;
    return clampPH(14 - (pKb + Math.log10(ratio)));
  }

  if (nAcid <= nBase + delta) {
    // Equivalence: pH set by relative strengths of conjugate pair
    return clampPH(7 + 0.5 * (pKa - pKb));
  }

  // Excess weak acid: HA / A- buffer
  // At this point all base has been converted to BH+.
  // The HA excess titrates against the already-formed BH+ as conjugate base source.
  // Use the weak acid pKa with ratio of A- (= nBase) to excess HA.
  const nHA_excess = nAcid - nBase;
  const ratio = nBase / nHA_excess;
  return clampPH(pKa + Math.log10(Math.max(ratio, EPS)));
}

// ---- Strong Base + Diprotic Acid ----

function _strongBaseDiproticAcid(nH2A, nOH, Vt_L, pKa1, pKa2) {
  const Ka1   = 10 ** -pKa1;
  const Ka2   = 10 ** -pKa2;
  const Veq1  = nH2A;
  const Veq2  = 2 * nH2A;
  const d1    = Veq1 * EQ_ZONE;
  const d2    = Veq2 * EQ_ZONE;

  if (nOH < EPS) {
    // Initial diprotic acid — use full quadratic for Ka1
    const C = nH2A / Vt_L;
    const H = posQuadRoot(1, Ka1, -Ka1 * C);
    return clampPH(-Math.log10(Math.max(H, EPS)));
  }

  if (nOH < Veq1 - d1) {
    // Buffer 1: H2A / HA-
    const ratio = nOH / (nH2A - nOH);
    return clampPH(pKa1 + Math.log10(ratio));
  }

  if (nOH <= Veq1 + d1) {
    // 1st equivalence zone: HA- is amphiprotic
    // True pH = (pKa1 + pKa2) / 2, corrected for concentration:
    // pH = 0.5*(pKa1 + pKa2 + log(C)) but (pKa1+pKa2)/2 is the standard approx
    return clampPH((pKa1 + pKa2) / 2);
  }

  if (nOH < Veq2 - d2) {
    // Buffer 2: HA- / A2-
    // moles of HA- consumed past Veq1 = (nOH - Veq1), so:
    const nA2   = nOH - Veq1;
    const nHA   = Veq1 - nA2;   // = 2*Veq1 - nOH
    if (nHA <= 0) return clampPH((pKa1 + pKa2) / 2);
    return clampPH(pKa2 + Math.log10(nA2 / nHA));
  }

  if (nOH <= Veq2 + d2) {
    // 2nd equivalence zone: A2- hydrolysis
    const C  = nH2A / Vt_L;
    const Kb = Kw / Ka2;
    const OH = Math.sqrt(Kb * C);
    return clampPH(14 + Math.log10(Math.max(OH, EPS)));
  }

  // Excess base
  return clampPH(14 + Math.log10((nOH - Veq2) / Vt_L));
}

// ---- Strong Base + Triprotic Acid ----

function _strongBaseTriproticAcid(nH3A, nOH, Vt_L, pKa1, pKa2, pKa3) {
  const Ka3   = 10 ** -pKa3;
  const Veq1  = nH3A;
  const Veq2  = 2 * nH3A;
  const Veq3  = 3 * nH3A;
  const d1    = Veq1 * EQ_ZONE;
  const d2    = Veq2 * EQ_ZONE;
  const d3    = Veq3 * EQ_ZONE;

  if (nOH < EPS) {
    const Ka1 = 10 ** -pKa1;
    const C   = nH3A / Vt_L;
    const H   = posQuadRoot(1, Ka1, -Ka1 * C);
    return clampPH(-Math.log10(Math.max(H, EPS)));
  }

  if (nOH < Veq1 - d1) {
    const ratio = nOH / (nH3A - nOH);
    return clampPH(pKa1 + Math.log10(ratio));
  }

  if (nOH <= Veq1 + d1) {
    return clampPH((pKa1 + pKa2) / 2);
  }

  if (nOH < Veq2 - d2) {
    const nH2A = nOH - Veq1;
    const nHA2 = Veq1 - nH2A; // = 2*Veq1 - nOH
    if (nHA2 <= 0) return clampPH((pKa1 + pKa2) / 2);
    return clampPH(pKa2 + Math.log10(nH2A / nHA2));
  }

  if (nOH <= Veq2 + d2) {
    return clampPH((pKa2 + pKa3) / 2);
  }

  if (nOH < Veq3 - d3) {
    const nA3  = nOH - Veq2;
    const nHA2 = Veq2 - nA3; // = 2*Veq2 - nOH ... wait, need correct:
    // moles of HA2- at start of region = Veq1 moles
    // as OH added: HA2- -> A3-, so nA3 = nOH - Veq2, nHA2 = Veq2 - (nOH - Veq2) = 2*Veq2 - nOH
    // Corrected:
    const nHA2c = 2 * Veq2 - nOH;  // won't redefine, use inline
    const nA3c  = nOH - Veq2;
    if (nHA2c <= 0) return clampPH((pKa2 + pKa3) / 2);
    return clampPH(pKa3 + Math.log10(nA3c / nHA2c));
  }

  if (nOH <= Veq3 + d3) {
    const C  = nH3A / Vt_L;
    const Kb = Kw / Ka3;
    const OH = Math.sqrt(Kb * C);
    return clampPH(14 + Math.log10(Math.max(OH, EPS)));
  }

  return clampPH(14 + Math.log10((nOH - Veq3) / Vt_L));
}

// ---- Utilities ----

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

function formatSci(value) {
  if (value === 0) return '0';
  const exp  = Math.floor(Math.log10(value));
  const mant = value / 10 ** exp;
  const sup  = (exp < 0 ? '⁻' : '⁺') +
    String(Math.abs(exp)).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
  return `${mant.toFixed(2)}×10${sup}`;
}
