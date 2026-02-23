/**
 * indicators.js
 * Indicator database and color interpolation utilities.
 */

'use strict';

const INDICATOR_DATABASE = {
  universal: {
    name: 'Universal Indicator',
    lowPH: 0, highPH: 14,
    gradient: 'linear-gradient(90deg, #ff0000 0%, #ff6600 14%, #ffff00 28%, #90ee90 43%, #00ff00 50%, #0ea5e9 64%, #0000ff 78%, #8a2be2 100%)',
    transitions: [
      { low:  0, high:  3, lowColor: [255,   0,   0], highColor: [255, 102,   0] },
      { low:  3, high:  6, lowColor: [255, 102,   0], highColor: [255, 255,   0] },
      { low:  6, high:  8, lowColor: [255, 255,   0], highColor: [144, 238, 144] },
      { low:  8, high: 11, lowColor: [144, 238, 144], highColor: [ 14, 165, 233] },
      { low: 11, high: 14, lowColor: [ 14, 165, 233], highColor: [138,  43, 226] },
    ],
  },
  methyl_violet: {
    name: 'Methyl Violet',
    lowPH: 0.0, highPH: 1.6,
    gradient: 'linear-gradient(90deg, #ffff00 0%, #8a2be2 100%)',
    transitions: [{ low: 0.0, high: 1.6, lowColor: [255, 255, 0], highColor: [138, 43, 226] }],
  },
  thymol_blue: {
    name: 'Thymol Blue (both ranges)',
    lowPH: 1.2, highPH: 9.6,
    gradient: 'linear-gradient(90deg, #ff0000 0%, #ffff00 15%, #ffff00 50%, #6495ed 100%)',
    transitions: [
      { low: 1.2, high: 2.8, lowColor: [255,   0,   0], highColor: [255, 255,   0] },
      { low: 8.0, high: 9.6, lowColor: [255, 255,   0], highColor: [100, 149, 237] },
    ],
  },
  orange_iv: {
    name: 'Orange IV',
    lowPH: 1.4, highPH: 2.8,
    gradient: 'linear-gradient(90deg, #ff0000 0%, #ff4500 50%, #ffa500 100%)',
    transitions: [{ low: 1.4, high: 2.8, lowColor: [255, 0, 0], highColor: [255, 165, 0] }],
  },
  methyl_orange: {
    name: 'Methyl Orange',
    lowPH: 3.1, highPH: 4.4,
    gradient: 'linear-gradient(90deg, #ff5050 0%, #ff8080 20%, #ffb366 30%, #ffeb82 100%)',
    transitions: [{ low: 3.1, high: 4.4, lowColor: [255, 80, 80], highColor: [255, 235, 130] }],
  },
  bromocresol_green: {
    name: 'Bromocresol Green',
    lowPH: 3.8, highPH: 5.4,
    gradient: 'linear-gradient(90deg, #ffeb82 0%, #c8e6c9 40%, #64c8dc 100%)',
    transitions: [{ low: 3.8, high: 5.4, lowColor: [255, 235, 130], highColor: [100, 200, 220] }],
  },
  methyl_red: {
    name: 'Methyl Red',
    lowPH: 4.4, highPH: 6.2,
    gradient: 'linear-gradient(90deg, #ff0000 0%, #ff6600 40%, #ffff00 100%)',
    transitions: [{ low: 4.4, high: 6.2, lowColor: [255, 0, 0], highColor: [255, 255, 0] }],
  },
  chromophenol_red: {
    name: 'Chromophenol Red',
    lowPH: 5.2, highPH: 6.8,
    gradient: 'linear-gradient(90deg, #ffff00 0%, #ff8040 50%, #ff0080 100%)',
    transitions: [{ low: 5.2, high: 6.8, lowColor: [255, 255, 0], highColor: [255, 0, 128] }],
  },
  bromothymol_blue: {
    name: 'Bromothymol Blue',
    lowPH: 6.0, highPH: 7.6,
    gradient: 'linear-gradient(90deg, #ffeb82 0%, #90ee90 50%, #6495ed 100%)',
    transitions: [{ low: 6.0, high: 7.6, lowColor: [255, 235, 130], highColor: [100, 149, 237] }],
  },
  phenol_red: {
    name: 'Phenol Red',
    lowPH: 6.8, highPH: 8.4,
    gradient: 'linear-gradient(90deg, #ffff00 0%, #ff8800 50%, #ff0000 100%)',
    transitions: [{ low: 6.8, high: 8.4, lowColor: [255, 255, 0], highColor: [255, 0, 0] }],
  },
  neutral_red: {
    name: 'Neutral Red',
    lowPH: 6.8, highPH: 8.0,
    gradient: 'linear-gradient(90deg, #ff0000 0%, #ff6600 50%, #ffa500 100%)',
    transitions: [{ low: 6.8, high: 8.0, lowColor: [255, 0, 0], highColor: [255, 165, 0] }],
  },
  phenolphthalein: {
    name: 'Phenolphthalein',
    lowPH: 8.2, highPH: 10.0,
    gradient: 'linear-gradient(90deg, #f5fbff 0%, #f5fbff 58%, #ffe3f1 70%, #ff6aa8 100%)',
    transitions: [{ low: 8.2, high: 10.0, lowColor: [245, 251, 255], highColor: [255, 106, 168] }],
  },
  thymolphthalein: {
    name: 'Thymolphthalein',
    lowPH: 9.3, highPH: 10.5,
    gradient: 'linear-gradient(90deg, #f5fbff 0%, #d0e8ff 60%, #6495ed 100%)',
    transitions: [{ low: 9.3, high: 10.5, lowColor: [245, 251, 255], highColor: [100, 149, 237] }],
  },
  alizarin_yellow: {
    name: 'Alizarin Yellow',
    lowPH: 10.1, highPH: 12.0,
    gradient: 'linear-gradient(90deg, #ffff00 0%, #ffaa00 50%, #ff8c00 100%)',
    transitions: [{ low: 10.1, high: 12.0, lowColor: [255, 255, 0], highColor: [255, 140, 0] }],
  },
  indigo_carmine: {
    name: 'Indigo Carmine',
    lowPH: 11.4, highPH: 13.0,
    gradient: 'linear-gradient(90deg, #4b0082 0%, #6a5acd 50%, #ffff00 100%)',
    transitions: [{ low: 11.4, high: 13.0, lowColor: [75, 0, 130], highColor: [255, 255, 0] }],
  },
};

/** Default indicator recommendation per titration type. */
const DEFAULT_INDICATORS = {
  strong_base_strong_acid:  'bromothymol_blue',
  strong_acid_strong_base:  'bromothymol_blue',
  strong_base_weak_acid:    'phenolphthalein',
  strong_acid_weak_base:    'methyl_orange',
  weak_acid_weak_base:      'bromocresol_green',
};

function getDefaultIndicator(titrationType) {
  return DEFAULT_INDICATORS[titrationType] || 'bromothymol_blue';
}

/**
 * Returns a THREE.Color for the given pH using the active indicator.
 * @param {string} indicatorKey
 * @param {number} pH
 * @returns {THREE.Color}
 */
function indicatorColor(indicatorKey, pH) {
  const ind = INDICATOR_DATABASE[indicatorKey] || INDICATOR_DATABASE.bromothymol_blue;

  for (const trans of ind.transitions) {
    if (pH >= trans.low && pH <= trans.high) {
      const t = clamp((pH - trans.low) / (trans.high - trans.low), 0, 1);
      return lerpColor(trans.lowColor, trans.highColor, t);
    }
  }

  // Below first transition
  if (pH < ind.transitions[0].low) {
    const c = ind.transitions[0].lowColor;
    return new THREE.Color(`rgb(${c[0]},${c[1]},${c[2]})`);
  }

  // Between transitions
  for (let i = 0; i < ind.transitions.length - 1; i++) {
    if (pH > ind.transitions[i].high && pH < ind.transitions[i + 1].low) {
      const c = ind.transitions[i].highColor;
      return new THREE.Color(`rgb(${c[0]},${c[1]},${c[2]})`);
    }
  }

  // Above last transition
  const c = ind.transitions[ind.transitions.length - 1].highColor;
  return new THREE.Color(`rgb(${c[0]},${c[1]},${c[2]})`);
}

// ---- Helpers ----

function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

function lerpColor(a, b, t) {
  const r = Math.round(a[0] * (1 - t) + b[0] * t);
  const g = Math.round(a[1] * (1 - t) + b[1] * t);
  const bl = Math.round(a[2] * (1 - t) + b[2] * t);
  return new THREE.Color(`rgb(${r},${g},${bl})`);
}
