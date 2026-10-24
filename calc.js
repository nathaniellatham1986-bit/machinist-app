// Pure math. Inputs in inch units.
export const rpm = (sfm, d) => sfm * 3.82 / d;
export const ipm = (r, fpt, z) => r * fpt * z;
// Radial chip thinning: when ae < D/2, raise fpt so actual chip = target.
export const thinFactor = (ae, d) => (ae >= d / 2 ? 1 : d / (2 * Math.sqrt(d * ae - ae * ae)));
// DERIVED shop rule (not manufacturer): reduce feed for stickout over 3xD, 10% per extra D, floor 50%.
export const stickoutFactor = (so, d) => Math.max(0.5, 1 - Math.max(0, so / d - 3) * 0.1);
// DERIVED power estimate: MRR x handbook-style unit power per ISO group (not manufacturer data).
export const UNIT_HP = { P: 1.0, M: 1.2, K: 0.6, N: 0.3, S: 1.8, H: 1.6 };
const cap = (r, max) => (max && r > max ? [max, true] : [r, false]);
export function compute({ sfm, d, fpt, z, ae, ap, stickout, maxRpm, maxHp, iso }) {
  const f = fpt * thinFactor(ae, d) * stickoutFactor(stickout, d);
  const [r, capped] = cap(rpm(sfm, d), maxRpm);
  let feed = ipm(r, f, z);
  let hp = feed * ae * ap * (UNIT_HP[iso] ?? 1), hpCapped = false;
  if (maxHp && hp > maxHp) { feed *= maxHp / hp; hp = maxHp; hpCapped = true; }
  return { rpm: r, fpt: f, ipm: feed, hp, mrr: feed * ae * ap, capped, hpCapped };
}
// Drilling: IPM = RPM x IPR.
export function drill({ sfm, d, ipr, maxRpm }) { const [r, capped] = cap(rpm(sfm, d), maxRpm); return { rpm: r, capped, ipm: r * ipr }; }
// Turning: RPM from SFM at workpiece D (capped); MRR in^3/min = vc(ft/min)*12 * ap(in) * f(in/rev).
export function turn({ sfm, d, ipr, ap, maxRpm }) {
  const [r, capped] = cap(rpm(sfm, d), maxRpm);
  const vAct = capped ? r * d / 3.82 : sfm;
  return { rpm: r, capped, ipm: r * ipr, mrr: vAct * 12 * ap * ipr, sfmActual: vAct };
}
// Tapping: feed = RPM x pitch.
export function tap({ sfm, d, pitch, maxRpm }) { const [r, capped] = cap(rpm(sfm, d), maxRpm); return { rpm: r, capped, ipm: r * pitch }; }
// Manufacturer range -> {min,max,def,basis} in inch units. Never invents: midpoint only when min&max given and no start, and is labeled.
export function pick(spec, k = 1) {
  if (!spec) return null;
  const s = v => (v == null ? null : v * k);
  if (spec.value != null) return { min: null, max: null, def: s(spec.value), basis: 'manufacturer value' };
  const min = s(spec.min), max = s(spec.max), start = s(spec.start);
  if (start != null) return { min, max, def: start, basis: 'manufacturer start value' };
  if (min != null && max != null) return { min, max, def: (min + max) / 2, basis: 'MIDPOINT of manufacturer range (no stated start)' };
  return null;
}

// Classify a source's stated coolant text. Through-tool only when the source says through/internal coolant. Never converted between modes.
export const COOL_NAMES = { flood: 'Flood', through: 'Through-tool', air: 'Air blast', dry: 'Dry' };
export function coolModes(s) { if (!s) return []; const m = [];
  if (/through|internal|\bTSC\b|\bIK\b|coolant[- ]fed|high[- ]pressure coolant/i.test(s)) m.push('through');
  if (/flood|cutting fluid|emulsion|wet|soluble|coolant(?! ?through)/i.test(s) && !/^\s*(internal|through)/i.test(s)) m.push('flood');
  if (/\bair\b|mist|MQL/i.test(s)) m.push('air'); if (/\bdry\b/i.test(s)) m.push('dry'); return [...new Set(m)]; }

// A source row printed as e.g. "303/304/316/316L/321" names 303 together with other austenitic grades: shown as printed, ranked after 303-specific data.
export const shared303 = c => !!c?.materials?.includes('ss303') && /\b30[124]L?\b|\b316|\b321\b|\b347\b|austenitic/i.test(c.sourceGroup ?? c.label ?? '');
