// Pure math. Inputs in inch units.
export const rpm = (sfm, d) => sfm * 3.82 / d;
export const ipm = (r, fpt, z) => r * fpt * z;
// Radial chip thinning: when ae < D/2, raise fpt so actual chip = target.
export const thinFactor = (ae, d) => (ae >= d / 2 ? 1 : d / (2 * Math.sqrt(d * ae - ae * ae)));
// DERIVED shop rule (not manufacturer): reduce feed for stickout over 3xD, 10% per extra D, floor 50%.
export const stickoutFactor = (so, d) => Math.max(0.5, 1 - Math.max(0, so / d - 3) * 0.1);
// DERIVED power: MRR (in^3/min) * unit power (hp per in^3/min), generic handbook-style unit power per ISO group.
export const UNIT_HP = { P: 1.0, M: 1.2, K: 0.6, N: 0.3, S: 1.8, H: 1.6 };
export function compute({ sfm, d, fpt, z, ae, ap, stickout, maxRpm, maxHp, iso }) {
  const f = fpt * thinFactor(ae, d) * stickoutFactor(stickout, d);
  let r = rpm(sfm, d), capped = false;
  if (maxRpm && r > maxRpm) { r = maxRpm; capped = true; }
  let feed = ipm(r, f, z);
  let hp = feed * ae * ap * (UNIT_HP[iso] ?? 1), hpCapped = false;
  if (maxHp && hp > maxHp) { feed *= maxHp / hp; hp = maxHp; hpCapped = true; }
  return { rpm: r, fpt: f, ipm: feed, hp, capped, hpCapped };
}
