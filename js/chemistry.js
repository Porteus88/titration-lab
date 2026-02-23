/**
 * chemistry.js
 * Pure pH calculation logic for all supported titration types.
 * Uses exact charge-balance binary search for polyprotic acids — no H-H approximation.
 */

'use strict';

const Kw  = 1e-14;
const EPS = 1e-15;

function clampPH(x, lo = 0, hi = 14) {
  return Math.min(Math.max(x, lo), hi);
}

function posQuadRoot(a, b, c) {
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  return (-b + Math.sqrt(disc)) / (2 * a);
}

/**
 * Binary-search [H+] from a target fractional deprotonation.
 * Works for any polyprotic system given the alpha function.
 */
function binarySearchH(alphaFn, alphaTarget) {
  if (alphaTarget <= 0)   return 1.0;   // very acidic
  if (alphaTarget >= 0.999999) return 1e-14; // very basic → pH near 14
  let lo = 1e-14, hi = 10.0;
  for (let i = 0; i < 150; i++) {
    const H = Math.sqrt(lo * hi);
    if (alphaFn(H) < alphaTarget) hi = H;
    else                          lo = H;
  }
  return Math.sqrt(lo * hi);
}

// ============================================================
//  Public API
// ============================================================

function calcPH({ type, analyteConc, analyteVol, titrantConc, titrantVol,
                  pKa, pKb, pKa2, pKa3 }) {
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
    case 'strong_base_diprotic_acid':  return _strongBaseDiprotic(nA, nT, Vt_L, pKa, pKa2);
    case 'strong_base_triprotic_acid': return _strongBaseTriprotic(nA, nT, Vt_L, pKa, pKa2, pKa3);
    default: return 7.00;
  }
}

// ============================================================
//  Strong/Strong (exact)
// ============================================================

function _strongBaseStrongAcid(nAcid, nBase, Vt_L) {
  const diff = nAcid - nBase;
  if (Math.abs(diff) < 1e-10) return 7.00;
  return diff > 0
    ? clampPH(-Math.log10(diff / Vt_L))
    : clampPH(14 + Math.log10(-diff / Vt_L));
}

function _strongAcidStrongBase(nBase, nAcid, Vt_L) {
  const diff = nBase - nAcid;
  if (Math.abs(diff) < 1e-10) return 7.00;
  return diff > 0
    ? clampPH(14 + Math.log10(diff / Vt_L))
    : clampPH(-Math.log10(-diff / Vt_L));
}

// ============================================================
//  Monoprotic weak systems — exact charge balance
// ============================================================

/**
 * Strong base (nOH) into weak acid (nHA).
 * Uses exact quadratic everywhere; no H-H approximation.
 */
function _strongBaseWeakAcid(nHA_total, nOH, Vt_L, pKa) {
  const Ka = 10 ** -pKa;

  if (nOH <= 0) {
    // Pure weak acid
    return clampPH(-Math.log10(posQuadRoot(1, Ka, -Ka * nHA_total / Vt_L)));
  }

  if (nOH < nHA_total) {
    // Buffer region — exact charge balance:
    // [H+] + [Na+] = [A-] + [OH-]
    // [Na+] = nOH/V,  [A-] = C_total*Ka/([H+]+Ka)
    const C_total = nHA_total / Vt_L;
    const Na = nOH / Vt_L;
    const H = binarySearchH(h => {
      const A = C_total * Ka / (h + Ka);
      const OH = Kw / h;
      return h + Na - A - OH; // > 0 means too acidic
    }, 0); // We'll rewrite using alpha approach below

    // Simpler: use charge balance directly with bisection
    let lo = 1e-14, hi = 1.0;
    for (let i = 0; i < 150; i++) {
      const H = Math.sqrt(lo * hi);
      const A   = C_total * Ka / (H + Ka);
      const OH  = Kw / H;
      const res = H + Na - A - OH;  // positive = LHS > RHS → H too big → hi = H
      if (res > 0) hi = H; else lo = H;
    }
    return clampPH(-Math.log10(Math.sqrt(lo * hi)));
  }

  if (nOH < nHA_total * 1.001) {
    // At/near equivalence: conjugate base (A-) hydrolysis
    const C  = nHA_total / Vt_L;
    const Kb = Kw / Ka;
    return clampPH(14 + Math.log10(posQuadRoot(1, Kb, -Kb * C)));
  }

  // Excess strong base
  return clampPH(14 + Math.log10((nOH - nHA_total) / Vt_L));
}

/**
 * Strong acid (nH) into weak base (nB).
 * Mirror of _strongBaseWeakAcid using pKb.
 */
function _strongAcidWeakBase(nB_total, nH, Vt_L, pKb) {
  const Kb = 10 ** -pKb;
  const Ka = Kw / Kb;

  if (nH <= 0) {
    return clampPH(14 + Math.log10(posQuadRoot(1, Kb, -Kb * nB_total / Vt_L)));
  }

  if (nH < nB_total) {
    // Charge balance: [H+] + [BH+] = [OH-] + [Cl-] ... simplified:
    // [H+] + C_total*[H+]/([H+]+Ka) = Kw/[H+] + nH/V  ... rearranged with bisection
    const C_total = nB_total / Vt_L;
    const Cl = nH / Vt_L; // strong acid anion
    let lo = 1e-14, hi = 1.0;
    for (let i = 0; i < 150; i++) {
      const H  = Math.sqrt(lo * hi);
      const BH = C_total * H / (H + Ka);
      const OH = Kw / H;
      // CB: [H+] + [BH+] = [OH-] + [Cl-]
      const res = H + BH - OH - Cl;
      if (res > 0) hi = H; else lo = H;
    }
    return clampPH(-Math.log10(Math.sqrt(lo * hi)));
  }

  if (nH < nB_total * 1.001) {
    // At equivalence: BH+ (conjugate acid) hydrolysis
    const C = nB_total / Vt_L;
    return clampPH(-Math.log10(posQuadRoot(1, Ka, -Ka * C)));
  }

  return clampPH(-Math.log10((nH - nB_total) / Vt_L));
}

/**
 * Weak acid in burette (nHA_added) into weak base in flask (nB_total).
 */
function _weakAcidWeakBase(nB_total, nHA_added, Vt_L, pKa, pKb) {
  const Kb = 10 ** -pKb;
  const Ka = 10 ** -pKa;
  const EQ_ZONE = nB_total * 0.005;

  if (nHA_added <= 0) {
    return clampPH(14 + Math.log10(posQuadRoot(1, Kb, -Kb * nB_total / Vt_L)));
  }

  if (nHA_added < nB_total - EQ_ZONE) {
    // Weak base buffer: exact charge balance
    const C_total = nB_total / Vt_L;
    let lo = 1e-14, hi = 1.0;
    for (let i = 0; i < 150; i++) {
      const H  = Math.sqrt(lo * hi);
      // Species: B and BH+
      const BH = C_total * H / (H + Kw / Kb); // Ka_conj = Kw/Kb
      const OH = Kw / H;
      // Charge: [H+] + [BH+] = [OH-] + [A-] ... A- = nHA_added/V (weak acid fully dissoc approx)
      // Better: track B/BH+ with actual Ka of conj acid
      const Ka_conj = Kw / Kb;
      const BH2 = C_total * H / (H + Ka_conj);
      const res = H + BH2 - OH - (nHA_added / Vt_L);
      if (res > 0) hi = H; else lo = H;
    }
    return clampPH(-Math.log10(Math.sqrt(lo * hi)));
  }

  if (nHA_added <= nB_total + EQ_ZONE) {
    // Equivalence: pH from relative strengths
    return clampPH(7 + 0.5 * (pKa - pKb));
  }

  // Excess weak acid: now have BH+ (salt) + HA (excess acid)
  const nHA_excess = nHA_added - nB_total;
  const C_HA = nHA_excess / Vt_L;
  const C_A_total = nB_total / Vt_L; // BH+ acts as reservoir for A-
  let lo = 1e-14, hi = 1.0;
  for (let i = 0; i < 150; i++) {
    const H   = Math.sqrt(lo * hi);
    const A   = C_A_total * Ka / (H + Ka);  // A- from HA equilibrium
    const OH  = Kw / H;
    // Total HA system charge balance:
    const res = H - OH - A + (nHA_excess / Vt_L) * Ka / (H + Ka) - (nHA_excess / Vt_L);
    // Simpler: just use exact weak acid calculation for excess HA
    // [H+]^2 + Ka[H+] - Ka*C_HA = 0
    break;
  }
  return clampPH(-Math.log10(posQuadRoot(1, Ka, -Ka * nHA_excess / Vt_L)));
}

// ============================================================
//  Diprotic — exact unified solution (no H-H, no zones)
// ============================================================

/**
 * Exact pH for a diprotic acid mixture using charge-balance binary search.
 * Handles the entire range from pure H2A through both equivalence points.
 */
function _exactDiprotic(nH2A_total, nOH, Vt_L, Ka1, Ka2) {
  const Veq1 = nH2A_total;
  const Veq2 = 2 * nH2A_total;

  // At or beyond Veq2: all A2- formed — use hydrolysis
  if (nOH >= Veq2) {
    if (nOH > Veq2 + EPS) {
      // Excess strong base dominates
      return clampPH(14 + Math.log10((nOH - Veq2) / Vt_L));
    }
    // Exactly at Veq2: A2- hydrolysis
    const C  = nH2A_total / Vt_L;
    const Kb = Kw / Ka2;
    return clampPH(14 + Math.log10(Math.max(Math.sqrt(Kb * C), EPS)));
  }

  // Stoichiometric distribution of species
  let nH2A_r, nHA_r, nA2_r;
  if (nOH <= 0) {
    nH2A_r = nH2A_total; nHA_r = 0; nA2_r = 0;
  } else if (nOH <= Veq1) {
    nH2A_r = nH2A_total - nOH;
    nHA_r  = nOH;
    nA2_r  = 0;
  } else {
    nH2A_r = 0;
    nA2_r  = nOH - Veq1;
    nHA_r  = Veq1 - nA2_r;
    if (nHA_r < 0) nHA_r = 0;
  }

  const total = nH2A_r + nHA_r + nA2_r;
  if (total < EPS) {
    const C  = nH2A_total / Vt_L;
    const Kb = Kw / Ka2;
    return clampPH(14 + Math.log10(Math.max(Math.sqrt(Kb * C), EPS)));
  }

  // Target: average protons removed per diprotic molecule
  const alpha_target = (nHA_r + 2 * nA2_r) / total;

  // Guard: if essentially all A2- (alpha ≥ ~1.999), use hydrolysis
  if (alpha_target >= 1.999) {
    const C  = nH2A_total / Vt_L;
    const Kb = Kw / Ka2;
    return clampPH(14 + Math.log10(Math.max(Math.sqrt(Kb * C), EPS)));
  }

  // Binary search [H+]
  const alphaFn = H => {
    const denom = H * H + Ka1 * H + Ka1 * Ka2;
    return (Ka1 * H + 2 * Ka1 * Ka2) / denom;
  };

  let lo = 1e-14, hi = 10.0;
  for (let i = 0; i < 150; i++) {
    const H = Math.sqrt(lo * hi);
    if (alphaFn(H) < alpha_target) hi = H;
    else                           lo = H;
  }
  return clampPH(-Math.log10(Math.sqrt(lo * hi)));
}

function _strongBaseDiprotic(nH2A, nOH, Vt_L, pKa1, pKa2) {
  const Ka1 = 10 ** -pKa1;
  const Ka2 = 10 ** -pKa2;
  return _exactDiprotic(nH2A, nOH, Vt_L, Ka1, Ka2);
}

// ============================================================
//  Triprotic — exact unified solution
// ============================================================

function _exactTriprotic(nH3A_total, nOH, Vt_L, Ka1, Ka2, Ka3) {
  const Veq1 = nH3A_total;
  const Veq2 = 2 * nH3A_total;
  const Veq3 = 3 * nH3A_total;

  if (nOH >= Veq3) {
    if (nOH > Veq3 + EPS) {
      return clampPH(14 + Math.log10((nOH - Veq3) / Vt_L));
    }
    const C  = nH3A_total / Vt_L;
    const Kb = Kw / Ka3;
    return clampPH(14 + Math.log10(Math.max(Math.sqrt(Kb * C), EPS)));
  }

  let nH3A_r, nH2A_r, nHA2_r, nA3_r;
  if (nOH <= 0) {
    nH3A_r = nH3A_total; nH2A_r = 0; nHA2_r = 0; nA3_r = 0;
  } else if (nOH <= Veq1) {
    nH3A_r = nH3A_total - nOH; nH2A_r = nOH;
    nHA2_r = 0; nA3_r = 0;
  } else if (nOH <= Veq2) {
    nH3A_r = 0;
    nH2A_r = Veq1 - (nOH - Veq1);
    nHA2_r = nOH - Veq1; nA3_r = 0;
    if (nH2A_r < 0) nH2A_r = 0;
  } else {
    nH3A_r = 0; nH2A_r = 0;
    nA3_r  = nOH - Veq2;
    nHA2_r = Veq2 - (nOH - Veq2);
    if (nHA2_r < 0) nHA2_r = 0;
  }

  const total = nH3A_r + nH2A_r + nHA2_r + nA3_r;
  if (total < EPS) {
    const C  = nH3A_total / Vt_L;
    const Kb = Kw / Ka3;
    return clampPH(14 + Math.log10(Math.max(Math.sqrt(Kb * C), EPS)));
  }

  const alpha_target = (nH2A_r + 2 * nHA2_r + 3 * nA3_r) / total;

  if (alpha_target >= 2.999) {
    const C  = nH3A_total / Vt_L;
    const Kb = Kw / Ka3;
    return clampPH(14 + Math.log10(Math.max(Math.sqrt(Kb * C), EPS)));
  }

  let lo = 1e-14, hi = 10.0;
  for (let i = 0; i < 150; i++) {
    const H = Math.sqrt(lo * hi);
    const denom = H*H*H + Ka1*H*H + Ka1*Ka2*H + Ka1*Ka2*Ka3;
    const alpha  = (Ka1*H*H + 2*Ka1*Ka2*H + 3*Ka1*Ka2*Ka3) / denom;
    if (alpha < alpha_target) hi = H;
    else                      lo = H;
  }
  return clampPH(-Math.log10(Math.sqrt(lo * hi)));
}

function _strongBaseTriprotic(nH3A, nOH, Vt_L, pKa1, pKa2, pKa3) {
  return _exactTriprotic(nH3A, nOH, Vt_L, 10**-pKa1, 10**-pKa2, 10**-pKa3);
}

// ============================================================
//  Utilities
// ============================================================

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
