// ESTIMATES (DERIVED, NOT MANUFACTURER DATA). Pure. Built at runtime from the SAME maker's other published records; never stored in data files.
// Rules (agreed with Nathaniel, App Build chat 2026-10-25): same brand only; same tool kind and mode; same material (303/304 never mixed);
// published size must cover the entered Ø or sit within 25% of it; stated coolant must match; >=2 distinct source tools; LOWEST low end used (no averaging).
import { pick, matchMat, coolModes, shared303, kindOf, rowDia, sizeRange, gradesOf, brandName, endGeom, ownNames } from './calc.js';
export const ESTIMATES_ON = true; // kill switch
export const EST_MIN = 2, EST_BAND = 0.25, EST_MODES = ['mill', 'drill', 'tap'];
const toIn = (v, u) => (u === 'mm' ? v / 25.4 : v), SPK = u => (u === 'm/min' ? 3.2808 : 1);
const inR = (r, d) => !!r && d >= r[0] - 1e-6 && d <= r[1] + 1e-6;
// D: '3/8 in' when a 64th fraction, else decimal
export const sizeTxt = x => { const n = Math.round(x * 64); if (Math.abs(n / 64 - x) < 1e-4 && n) { let a = n, b = 64; while (a % 2 === 0) { a /= 2; b /= 2; } const w = Math.floor(a / b), r = a % b; return `${w ? w + (r ? ' ' : '') : ''}${r ? r + '/' + b : ''} in`; } return `${+x.toFixed(4)} in`; };
export const nearSize = (r, d) => !!r && d > 0 && (d >= r[0] - 1e-6 && d <= r[1] + 1e-6 || Math.min(Math.abs(d - r[0]), Math.abs(d - r[1])) <= EST_BAND * d + 1e-6);
const lowOf = (spec, k) => { const p = pick(spec, k); return p ? (p.min ?? p.def) : null; };
// Material: named match preferred; 303 and 304 only from rows naming that grade alone.
function matOk(m, c) { const r = matchMat(m, c); if (!r) return null; if (c.iso === '*' && r !== 'named') return null;
  if (m.id === 'ss303' || m.id === 'ss304') { if (r !== 'named') return null; const both = c.materials?.includes('ss303') && c.materials?.includes('ss304');
    if (both || (m.id === 'ss303' ? shared303(c) : /\b303\b/.test(`${c.label} ${c.sourceGroup ?? ''}`))) return null; }
  return r; }
// Chip load / IPR at Ø d from a record: exact Ø, else nearest SMALLER published Ø within 25% (smaller = lower chip load; never extrapolated up).
export function feedLow(c, t, d) { const f = c.feed; if (!f) return null; const u = toIn(1, f.unit);
  if (f.byDiameter) { const ks = Object.keys(f.byDiameter).map(k => [k, +k * u]).filter(([, x]) => x <= d + 1e-4 && x >= d * (1 - EST_BAND)); // never a LARGER published Ø
    if (!ks.length) return null; const [k, x] = ks.sort((a, b) => Math.abs(a[1] - d) - Math.abs(b[1] - d))[0], v = f.byDiameter[k];
    return { v: lowOf(typeof v === 'object' ? v : { value: v }, u), at: x }; }
  if (f.bands) { const b = f.bands.filter(([a, z]) => a * u <= d + 1e-4 && z * u >= d * (1 - EST_BAND)).sort((p, q) => q[1] - p[1])[0];
    return b ? { v: b[2] * u, at: Math.min(d, b[1] * u) } : null; }
  if (f.range) { const r = rowDia(c) ?? sizeRange(t); return nearSize(r, d) ? { v: lowOf(f.range, u), at: null } : null; }
  return null; }
const srcText = s => [s.catalog, s.edition, s.page ? 'p.' + s.page : ''].filter(Boolean).join(' · ');
// target: {brand, mode, series, type, grade}; cands: [{key, tool}] (full tools); mat: material object; d (in); cool; need: {sfm, fpt}
export function estimate({ target, targetTool, targetKey, cands, geom = true, own = true, mat, d, cool, need = { sfm: true, fpt: true }, on = ESTIMATES_ON }) {
  const out = { sfm: null, fpt: null }; if (!on || !target || !mat || !(d > 0) || !EST_MODES.includes(target.mode)) return out;
  if (own && targetTool && !ownNames(targetTool, mat)) return out; // B: only materials this tool's own records name
  const eg = target.mode === 'mill' ? endGeom(target) : null; if (geom && target.mode === 'mill' && !eg) return out; // A: unknown end geometry → no estimate
  const kind = kindOf(target), coat = String(target.grade ?? target.coating ?? '').toLowerCase(), fk = target.mode === 'mill' ? 'fz' : 'ipr';
  const rows = { sfm: [], fpt: [] };
  for (const { key, tool: t } of cands) {
    if (!t || key === targetKey || brandName(t.brand) !== brandName(target.brand) || t.mode !== target.mode || kindOf(t) !== kind || geom && eg && endGeom(t) !== eg) continue;
    for (const c of t.conditions) {
      if (c.status === 'shop-proven' || !c.source || !['catalog', 'label'].includes(c.source.kind)) continue;
      const mm = matOk(mat, c); if (!mm) continue;
      const cm = coolModes(typeof c.coolant === 'string' ? c.coolant : ''); if (cm.length && !cm.includes(cool)) continue;
      const g = gradesOf(t, c), sameCoat = !!coat && g.some(x => x.toLowerCase() === coat);
      const base = { key, brand: brandName(t.brand), series: t.series, coating: g.join(', ') || null, label: c.label, source: srcText(c.source), url: c.source.url ?? null, named: mm === 'named', sameCoat };
      if (need.sfm && c.sfm) { const r = rowDia(c) ?? sizeRange(t); const v = lowOf(c.sfm, SPK(c.sfm.unit)); if (v > 0 && nearSize(r, d)) rows.sfm.push({ ...base, value: v, size: r, close: !inR(r, d) }); }
      if (need.fpt && target.mode !== 'tap' && c.feed && (c.feed.kind ?? fk) === fk) { const f = feedLow(c, t, d); if (f?.v > 0) { const r = rowDia(c) ?? sizeRange(t); rows.fpt.push({ ...base, value: f.v, at: f.at, size: r, close: !!r && !inR(r, d) }); } }
    } }
  const tools = l => new Set(l.map(x => x.key)).size;
  for (const k of ['sfm', 'fpt']) { let l = rows[k];
    if (tools(l.filter(x => x.named)) >= EST_MIN) l = l.filter(x => x.named); // same specific material first
    if (tools(l.filter(x => x.sameCoat)) >= EST_MIN) l = l.filter(x => x.sameCoat); // closest coating first
    if (tools(l) < EST_MIN) continue;
    l = [...l].sort((a, b) => a.value - b.value);
    out[k] = { def: l[0].value, n: tools(l), sources: l, d, close: l.some(x => x.close), derived: true, est: true }; }
  return out; }
