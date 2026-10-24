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

// Printed per-diameter RPM/table feed ("printed" block). Exact diameter match only (no interpolation).
const IN = { in: 1, mm: 1 / 25.4 };
export function printedAt(c, dIn) {
  const p = c?.printed; if (!p?.byDiameter || !dIn) return null;
  for (const [k, e] of Object.entries(p.byDiameter)) if (Math.abs(+k * IN[p.unit] - dIn) < 0.0006) return { ...e, key: k, unit: p.unit };
  return null;
}
// Manufacturer RPM and table feed, scaled together only when the machine RPM cap is below the printed RPM (keeps chip load).
export function printedRun(e, { dIn, z, maxRpm }) {
  const capped = !!(maxRpm && e.rpm > maxRpm), s = capped ? maxRpm / e.rpm : 1, rpm = e.rpm * s;
  const tf = e.tableFeed ? e.tableFeed.value * (e.tableFeed.unit === 'mm/min' ? 1 / 25.4 : 1) : null, ipm = tf == null ? null : tf * s;
  return { rpm, ipm, capped, printedRpm: e.rpm, printedIpm: tf, sfm: rpm * dIn * Math.PI / 12, fz: ipm != null && z ? ipm / (rpm * z) : null };
}

// ---- Review #1 helpers (pure) ----
// Printed hardness -> [lo, hi] in HB (HRC converted by a standard table; DERIVED for matching only).
const HRC_HB = [[20, 226], [25, 253], [28, 271], [30, 286], [32, 301], [35, 327], [40, 371], [44, 409], [48, 451], [52, 500], [56, 560], [60, 615], [65, 690]];
export const hrcToHb = h => { const T = HRC_HB; if (h <= T[0][0]) return T[0][1] - (T[0][0] - h) * 5;
  for (let i = 1; i < T.length; i++) if (h <= T[i][0]) { const [a, x] = T[i - 1], [b, y] = T[i]; return x + (y - x) * (h - a) / (b - a); } return T.at(-1)[1]; };
export function hardnessHB(text) {
  const s = String(text ?? ''), U = '(HRC|Rc|HRc|HB\\w*|BHN|HB)';
  let m = s.match(new RegExp(`(≤|<=|<|up to|max\\.?)?\\s*(\\d+(?:\\.\\d+)?)(?:\\s*[-–~]\\s*(\\d+(?:\\.\\d+)?))?\\s*${U}\\b`, 'i'));
  let le, a, b, u; if (m) [, le, a, b, u] = m; else { m = s.match(new RegExp(`${U}\\s*(≤|<=|<)?\\s*(\\d+)(?:\\s*[-–~]\\s*(\\d+))?`, 'i')); if (!m) return null; [, u, le, a, b] = m; }
  const hrc = /r/i.test(u) && !/bhn/i.test(u), f = x => hrc ? hrcToHb(+x) : +x;
  return le && !b ? [0, f(a)] : [f(a), f(b ?? a)]; }
// Material match: 'named' when the record names the alloy, 'group' when its printed group/hardness fits, else null.
export function matchMat(m, c) {
  const text = [c.label, c.sourceGroup, c.subgroup, c.material].filter(Boolean).join(' ');
  if (c.materials?.includes(m.id) || (m.named && new RegExp(m.named, 'i').test(text))) {
    if (!m.hb) return 'named'; const h = hardnessHB(text); return !h || (h[0] <= m.hb[1] && h[1] >= m.hb[0]) ? 'named' : null; }
  if (c.materials && !m.named) return null;
  if (c.iso !== '*' && c.iso !== m.iso) return null;
  if (m.group && !new RegExp(m.group, 'i').test(text)) return null;
  if (m.hb) { const h = hardnessHB(text); if (h && !(h[0] <= m.hb[1] && h[1] >= m.hb[0])) return null; }
  return 'group'; }
// Plain condition choices mapped from the record's own label/operation text.
export const passOf = c => { const s = `${c.label} ${c.operation ?? ''} ${c.subgroup ?? ''}`; return /finish|light/i.test(s) ? 'Finish' : /rough|heavy/i.test(s) ? 'Rough' : 'Medium'; };
export const cutOf = c => { const s = `${c.label} ${c.operation ?? ''}`; return /\bHEM\b|dynamic|trochoid|high.?eff|adaptive|HPC/i.test(s) ? 'HEM' : /slot|full width|groov/i.test(s) ? 'Slot' : /side|profil|periph|contour|shoulder/i.test(s) ? 'Side' : ''; };
export const turnOpOf = (t, c) => { const s = `${c?.operation ?? ''} ${t.series} ${t.type ?? ''}`; return /thread/i.test(s) ? 'Thread' : /part|cut.?off/i.test(s) ? 'Part' : /groov/i.test(s) ? 'Groove' : /fac/i.test(s) ? 'Face' : 'Turn'; };
// All operations a record names ("parting / grooving insert" → Part and Groove); used by the Operation filter.
export const turnOpsOf = (t, c) => { const o = turnOpOf(t, c), s = `${c?.operation ?? ''} ${t.series} ${t.type ?? ''}`; return o === 'Part' && /groov/i.test(s) ? ['Part', 'Groove'] : [o]; };
export const kindOf = t => { const s = `${t.type ?? ''} ${t.series}`, m = t.mode;
  return /thread mill/i.test(s) ? 'Thread mill' : m === 'tap' ? 'Tap' : m === 'bore' || /bor/i.test(s) && m !== 'drill' ? 'Boring' : /insert|indexable/i.test(s) || m === 'turn' ? 'Insert' : m === 'drill' ? 'Drill' : 'End mill'; };
export const tapTypeOf = t => { const s = `${t.type ?? ''} ${t.series}`; return /form|roll|flutel/i.test(s) ? 'form' : /spiral point|gun|straight/i.test(s) ? 'point' : /spiral/i.test(s) ? 'flute' : ''; };
// General shop guidance (NOT manufacturer data).
export const boreLimit = shank => shank === 'carbide' ? 6 : 4;
export const css = ({ sfm, d0, d1, maxRpm }) => { const r = d => (sfm * 12) / (Math.PI * d), at = d => maxRpm ? Math.min(r(d), maxRpm) : r(d);
  return { rpm0: at(d0), rpm1: at(d1), clampDia: maxRpm ? (sfm * 12) / (Math.PI * maxRpm) : null }; };
// Grade/coating split (pure). Order = record order; never our own ranking.
export const REC = /first.?choice|recommended grade|preferred grade/i;
export const gradesOf = (t, c) => String(c.grade ?? t.grade ?? t.coating ?? '').split(/,\s*/).map(x => x.trim()).filter(Boolean);
// members: [{ key, tool }]; ok(c): condition matches material & has data. Returns grades with data first, then no-data ones.
export const gradeList = (members, ok) => { const opts = new Map();
  for (const { key, tool } of members) for (const c of tool.conditions) for (const g of gradesOf(tool, c)) {
    const o = opts.get(g) ?? { g, id: key + '|' + g, has: false, rec: false }; opts.set(g, o);
    if (ok(c)) { if (!o.has) o.id = key + '|' + g; o.has = true; if (REC.test(`${c.label ?? ''} ${c.note ?? ''}`)) o.rec = true; } }
  const L = [...opts.values()]; return [...L.filter(o => o.has), ...L.filter(o => !o.has)]; };
// cur: previously chosen id (kept if it still has data). why: 'kept' | 'rec' | 'auto' | null
export const pickGrade = (list, cur) => { const has = list.filter(o => o.has);
  const k = has.find(o => o.id === cur); if (k) return { pick: k, why: k.rec ? 'rec' : 'kept' };
  const r = has.find(o => o.rec); if (r) return { pick: r, why: 'rec' };
  return has[0] ? { pick: has[0], why: 'auto' } : { pick: null, why: null }; };
// Display name for a tool with the grade stripped; grade-only records fall back to the record's own series qualifier / type.
export const geoName = t => { const short = s => s.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);
  let s = t.series; if (t.grade) for (const g of t.grade.split(/[,/]\s*/)) s = s.split(g).join(' ');
  const n = short(s.replace(/\b(turning|parting|grooving|threading|milling|drilling|insert)?\s*grade\b/gi, ' ').replace(/\s*[—–-]\s*$/, '').replace(/^\s*[—–-]\s*/, ''));
  if (n) return n; const q = (t.series.match(/\(([^)]*)\)/) ?? [])[1], ty = (t.type ?? '').split(/\s+[—–-]\s+/)[0];
  return [ty ? ty.replace(/grade$/i, 'grades') : 'Grades', q].filter(Boolean).join(' · ').slice(0, 70); };
// Printed feed-per-tooth as a multiple of tool diameter (fzPerD). fz = multiplier × D, in the record's (= D's) length unit.
export const fzFromPerD = (p, d) => { const m = pick(p, 1); if (!m || !(d > 0)) return null; const f = x => +x.toPrecision(3);
  const r = pick(p, d); r.basis = `MFR FORMULA (${f(m.def)}×D)` + (p.start == null && p.value == null ? `, MIDPOINT of printed ${f(m.min)}–${f(m.max)}×D` : '') + (m.min != null && p.start != null ? ` · printed ${f(m.min)}–${f(m.max)}×D` : ''); r.formula = true; return r; };
// Row preference for a picked material (default selection only; printed text only, no judgment of values).
// 0 = row text names the material class, 1 = neutral, 2 = row text names a different class.
const ALLOY_IDS = /^(p-alloy|4140|4340)/, ALLOY = /alloy|\b4[13]\d\d\b|CrMo|CrNiMo|\bSCM|\bSNCM/i, NONALLOY = /non.?alloy|unalloy|free.?(machin|cut)|\bmild\b|carbon steel|structural/i;
const AUST = /austenit|\b05\.2|\bM1\b|\bM1\.|\b30[1-9]L?\b|\b31[0-9]L?\b/i, NONAUST = /ferrit|martensit|duplex|precipitation|\b05\.[13]|\b4[0-4]\d\b(?!\s*(HB|HV|HRC|N))/i;
export const matPref = (id, c) => { const s = [c.label, c.sourceGroup, c.subgroup, c.material].filter(Boolean).join(' ');
  if (ALLOY_IDS.test(id ?? '')) return NONALLOY.test(s) ? 2 : ALLOY.test(s) ? 0 : 1;
  return 1; };
