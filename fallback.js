// Feed fallback ladder and the step-5 baseline. Pure. Baseline cells are published catalog numbers
// (lowest low end in the cell, feed from that same row). Nothing here is averaged or invented.
import { pick, lowEnd, matchMat, matBad, cutOf, passOf, kindOf, brandName, compute, drill, turn } from './calc.js';

export const SLOT_FACTOR = 0.75; // shop rule from the engineer, not a manufacturer number
export const DIA_BANDS = [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 1, 1.5, 2, 3];
export const COAT_LABEL = { uncoated: 'Uncoated', unknown: 'Coated, type unknown', tin: 'TiN', ticn: 'TiCN', altin: 'TiAlN/AlTiN', zrn: 'ZrN', dlc: 'DLC/diamond' };
const SPK = u => (u === 'm/min' ? 3.2808 : 1);
const toIn = (v, u) => (u === 'mm' ? v / 25.4 : v);
export const pageNum = p => { const m = String(p ?? '').match(/\d+/); return m ? m[0] : ''; };
const bandOf = d => DIA_BANDS.reduce((b, x) => Math.abs(x - d) < Math.abs(b - d) ? x : b, DIA_BANDS[0]);

export function substrateOf(t) {
  const s = `${t?.series ?? ''} ${t?.type ?? ''} ${t?.notes ?? ''} ${t?.specs?.coating ?? ''} ${t?.coating ?? ''}`;
  if (/cobalt|HSS-?Co|HSS-E/i.test(s)) return 'cobalt';
  if (t?.specs?.substrate === 'carbide' || /carbide|\bVHM\b/i.test(s)) return 'carbide';
  if (t?.specs?.substrate === 'hss' || /\bHSS\b|high.?speed steel/i.test(s)) return 'hss';
  return 'unspecified';
}
export function coatOf(t, c) {
  const s = `${t?.specs?.coating ?? ''} ${t?.coating ?? ''} ${c?.grade ?? ''} ${t?.series ?? ''} ${t?.type ?? ''}`;
  const cls = t?.specs?.coatingClass;
  if (cls === 'uncoated' || /uncoated|\bbright\b/i.test(s)) return 'uncoated';
  if (/ZrN|zirconium/i.test(s)) return 'zrn';
  if (cls === 'diamond' || /\bDLC\b|diamond/i.test(s)) return 'dlc';
  if (cls === 'ticn' || /TiCN/i.test(s)) return 'ticn';
  if (cls === 'al-based' || /AlTiN|TiAlN/i.test(s)) return 'altin';
  if (cls === 'tin' || /\bTiN\b/i.test(s)) return 'tin';
  return 'unspecified';
}
// Printed light-radial limit, when the row states one. null when the row prints no WOC range.
export function radialLimit(c) {
  const s = `${c?.operation ?? ''} ${c?.label ?? ''}`;
  let maxAe = null, maxFrac = null;
  const inch = s.match(/<\s*(\.\d+|\d+\.\d+)\s*(?:in\s*)?radial/i);
  if (inch) maxAe = parseFloat(inch[1]);
  const pct = s.match(/<\s*(\d+(?:\.\d+)?)\s*%/);
  if (pct) maxFrac = parseFloat(pct[1]) / 100;
  if (c?.aex > 0) maxFrac = maxFrac == null ? c.aex : Math.min(maxFrac, c.aex);
  if (maxAe == null && maxFrac == null) return null;
  return { maxAe, maxFrac };
}
export function radialCovers(c, ae, d) {
  const r = radialLimit(c);
  if (!r || !(ae >= 0)) return false;
  if (r.maxAe != null && ae > r.maxAe + 1e-9) return false;
  if (r.maxFrac != null && !(d > 0 && ae / d <= r.maxFrac + 1e-9)) return false;
  return true;
}
// Tightest maker finishing row whose printed radial range contains this WOC. null if none.
export function preferFinish(conditions, ae, d, ok = () => true) {
  let best = null;
  conditions.forEach((c, i) => {
    if (!ok(c) || passOf(c) !== 'Finish' || !radialCovers(c, ae, d) || !c.sfm || !c.feed) return;
    const r = radialLimit(c);
    const tight = r.maxAe != null && d > 0 ? r.maxAe / d : (r.maxFrac ?? 1);
    if (!best || tight < best.tight - 1e-9) best = { i, tight };
  });
  return best ? best.i : null;
}
export function thinNote({ brand, ae, d, fpt, th }) {
  if (!th || !(th.factor > 1 + 1e-6)) return '';
  const w = d > 0 ? Math.round((ae / d) * 100) : 0;
  if (th.capped) {
    const up = Math.round((th.raw - 1) * 100), unc = fpt * th.raw;
    return `Thinning capped at ${th.cap}× (app limit, not ${brand}'s number). Your WOC is ${w}% of D; light WOC this small is usually a finishing pass. Uncapped would be ${unc.toFixed(4)} in/t (+${up}%).`;
  }
  return `Radial chip thinning +${Math.round((th.factor - 1) * 100)}% (derived, not a manufacturer number).`;
}

const lowNum = (spec, k) => { const p = lowEnd(pick(typeof spec === 'number' ? { value: spec } : spec, k)); return p?.def > 0 ? p.def : null; };
function packFeed(f) {
  if (!f) return null;
  const k = toIn(1, f.unit), out = { kind: f.kind || 'fz' };
  if (f.byDiameter) out.points = Object.entries(f.byDiameter).map(([dia, v]) => [+dia * k, lowNum(v, k)]).filter(x => x[1] > 0);
  if (f.bands) out.bands = f.bands.map(([a, b, v]) => [a * k, b * k, v * k]).filter(x => x[2] > 0);
  if (f.range) { const n = lowNum(f.range, k); if (n > 0) out.range = n; }
  if (!out.points?.length && !out.bands?.length && out.range == null) return null;
  return out;
}
function feedAt(feed, d, nearest) {
  if (!feed || !(d > 0)) return null;
  if (feed.range != null) return { v: feed.range, exact: true, at: d };
  if (feed.bands) { const b = feed.bands.find(([a, z]) => d >= a - 1e-4 && d <= z + 1e-4); if (b) return { v: b[2], exact: true, at: d }; }
  let near = null;
  for (const [x, v] of feed.points ?? []) {
    if (Math.abs(x - d) < 0.02) return { v, exact: true, at: x };
    const dist = Math.abs(x - d);
    if (!near || dist < near.dist) near = { v, at: x, dist, exact: false };
  }
  return nearest ? near : null;
}
export function packTool(t, key = '') {
  if (!t) return null;
  const rows = [];
  for (const c of t.conditions ?? []) {
    if (!c || c.status === 'shop-proven' || c.paired || !c.sfm || !c.source || !['catalog', 'label'].includes(c.source.kind)) continue;
    if (!c.source.url && !c.source.page) continue;
    const sfm = lowNum(c.sfm, SPK(c.sfm.unit));
    const feed = c.feed ? packFeed(c.feed) : null;
    if (!(sfm > 0) || (t.mode !== 'tap' && !feed)) continue;
    rows.push({
      iso: c.iso, cut: cutOf(c), pass: passOf(c), sfm, feed, label: c.label || '', operation: c.operation || '',
      materials: c.materials, sourceGroup: c.sourceGroup, subgroup: c.subgroup, material: c.material,
      strictMaterials: c.strictMaterials, excludeMaterials: c.excludeMaterials,
      page: c.source.page || '', url: c.source.url || '', catalog: c.source.catalog || '', coat: coatOf(t, c),
    });
  }
  if (!rows.length) return null;
  return {
    key, brand: brandName(t.brand), series: t.series || '', type: t.type || '', mode: t.mode, kind: kindOf(t),
    sub: substrateOf(t), flutes: t.flutes || t.specs?.flutes || null, rows,
  };
}
const rowMat = (mat, iso, c) => mat ? !!matchMat(mat, c) && !matBad(mat, c) : (!iso || c.iso === iso || c.iso === '*');
function hitOf(tool, row, fd, cut) {
  const adj = cut === 'Slot' && row.cut !== 'Slot' ? { fpt: fd.v * SLOT_FACTOR, factor: SLOT_FACTOR } : { fpt: fd.v, factor: 1 };
  return { tool, row, fd, ...adj };
}
function describe(step, h, target) {
  const pg = pageNum(h.row?.page || h.page), p = pg ? ` p. ${pg}` : '';
  const brand = h.tool?.brand || h.brand, series = h.tool?.series || h.series;
  if (step === 2 && h.factor === SLOT_FACTOR) return `Estimate: ${brand} ${series}${p}, chip load ×0.75 for slotting (shop rule, not ${brand}'s number)`;
  if (step === 2) return `Estimate: ${brand} ${series}${p}, ${h.row.cut || 'general'} row used for ${target.cut} (no ${target.cut} row printed)`;
  if (step === 3) return `Estimate: ${brand} ${series}${p} (same maker, nearest ${h.sameSeries ? 'series' : 'type'}; no row on the selected tool)`;
  if (step === 4) return `Estimate: ${brand} ${series}${h.tool?.flutes ? `, ${h.tool.flutes}-fl` : ''}${h.tool?.sub && h.tool.sub !== 'unspecified' ? ' ' + h.tool.sub : ''}${p} (no ${target.tool?.brand || 'matching'} row)`;
  const derived = h.derived?.length ? ` — derived from the nearest sourced cell (${h.derived.join(', ')})` : '';
  const slot = h.factor === SLOT_FACTOR ? ', chip load ×0.75 for slotting (shop rule, not the maker\'s number)' : '';
  return `Estimate: baseline ${brand} ${series}${p}${derived}${slot}`;
}
function packHit(step, h, target) {
  const text = step === 1 ? '' : describe(step, h, target);
  return {
    step, estimate: step > 1, sfm: h.row?.sfm ?? h.sfm, fpt: h.fpt ?? null, feedKind: h.row?.feed?.kind || h.feedKind || 'fz',
    text, url: h.row?.url || h.url || '', page: h.row?.page || h.page || '', brand: h.tool?.brand || h.brand, series: h.tool?.series || h.series,
    slotFactor: h.factor || 1, catalog: h.row?.catalog || h.catalog || '', derived: h.derived || [],
  };
}
function bestRow(tool, { mat, iso, cut, d, nearest, cutOk }) {
  let best = null;
  for (const row of tool.rows) {
    if (!rowMat(mat, iso, row)) continue;
    if (cut && !cutOk(row)) continue;
    const fd = feedAt(row.feed, d, nearest);
    if (!fd && tool.mode !== 'tap') continue;
    if (tool.mode === 'tap' && !(row.sfm > 0)) continue;
    const named = mat && matchMat(mat, row) === 'named' ? 0 : 1;
    const exact = fd?.exact ? 0 : 1;
    const score = named * 10 + exact;
    if (!best || score < best.score - 1e-9 || (score === best.score && row.sfm < best.row.sfm)) best = { row, fd: fd || { v: null, exact: true, at: d }, score };
  }
  return best;
}
// First step that has a number. maxStep stops early (1 = old exact-only behavior).
export function resolveFeed({ tool, mat, iso, mode, cut = '', d, pool = [], baseline = null, maxStep = 5 }) {
  if (!(d > 0)) return null;
  const target = { tool, mat, iso, mode, cut, d };
  if (tool) {
    const exact = bestRow(tool, { mat, iso, cut, d, nearest: false, cutOk: row => !cut || row.cut === cut });
    if (exact) return packHit(1, { ...hitOf(tool, exact.row, exact.fd, ''), factor: 1, fpt: exact.fd?.v ?? null }, target);
    if (maxStep < 2) return null;
    if (cut) {
      let other = null;
      for (const cutOk of [row => row.cut === '' || row.cut === 'Side', row => row.cut !== cut]) {
        other = bestRow(tool, { mat, iso, cut, d, nearest: false, cutOk });
        if (other) break;
      }
      if (other) return packHit(2, hitOf(tool, other.row, other.fd, cut), target);
    }
  }
  if (maxStep < 3) return null;
  const scoreTool = (t, step) => {
    if (!t || t.key === tool?.key || t.mode !== (tool?.mode || mode)) return null;
    if (step === 3 && t.brand !== tool?.brand) return null;
    if (step === 4 && (!tool || t.brand === tool.brand || t.kind !== tool.kind)) return null;
    const row = bestRow(t, { mat, iso, cut: '', d, nearest: true, cutOk: () => true });
    if (!row) return null;
    const dia = row.fd?.at != null ? Math.abs(row.fd.at - d) : 0;
    const fl = tool?.flutes && t.flutes ? Math.abs(t.flutes - tool.flutes) : 5;
    const sub = tool && t.sub === tool.sub ? 0 : 2;
    const series = tool && t.series === tool.series ? 0 : 1;
    const cutPen = cut === 'Slot' && row.row.cut === 'Slot' ? 0 : 0.2;
    return { t, row, score: (step === 3 ? series * 100 : 0) + dia * 20 + fl + sub * 3 + cutPen };
  };
  if (tool) {
    let best = null;
    for (const t of pool) { const s = scoreTool(t, 3); if (s && (!best || s.score < best.score)) best = s; }
    if (best) return packHit(3, { ...hitOf(best.t, best.row.row, best.row.fd, cut), sameSeries: best.t.series === tool.series }, target);
  }
  if (maxStep < 4 || !tool) {
    // step 4 needs a tool type to match; without one, go to the baseline
  } else {
    let best = null;
    for (const t of pool) { const s = scoreTool(t, 4); if (s && (!best || s.score < best.score)) best = s; }
    if (best) return packHit(4, hitOf(best.t, best.row.row, best.row.fd, cut), target);
  }
  if (maxStep < 5 || !baseline) return null;
  const q = { mode: tool?.mode || mode, kind: tool?.kind || 'End mill', sub: tool?.sub || 'unspecified', coat: 'uncoated', iso: iso || mat?.iso, d, feedKind: (tool?.mode || mode) === 'mill' ? 'fz' : 'ipr' };
  const cell = lookupBaseline(baseline, q, false);
  if (!cell) return null;
  const h = { brand: cell.c.brand, series: cell.c.series, page: cell.c.page, url: cell.c.url, catalog: cell.c.catalog, sfm: cell.c.sfm, fpt: cell.c.feed, factor: cut === 'Slot' ? SLOT_FACTOR : 1, derived: cell.derived, feedKind: cell.c.feedKind, row: null };
  if (h.factor === SLOT_FACTOR) h.fpt *= SLOT_FACTOR;
  return packHit(5, h, target);
}

// ---- step 5 baseline, built from catalog rows already in data/ ----
const CELLS = new Map();
export function resetBaseline() { CELLS.clear(); }
function consider(cell) {
  const k = [cell.mode, cell.kind, cell.sub, cell.coat, cell.iso, cell.dia, cell.feedKind].join('|');
  const prev = CELLS.get(k);
  if (!prev || cell.sfm < prev.sfm - 1e-9 || (Math.abs(cell.sfm - prev.sfm) < 1e-9 && cell.feed < prev.feed)) CELLS.set(k, cell);
}
export function noteBaseline(t) {
  if (!t?.conditions) return;
  const sub = substrateOf(t), kind = kindOf(t);
  for (const c of t.conditions) {
    if (!c?.sfm || !c.feed || c.status === 'shop-proven' || c.paired || c.iso === '*' || !c.source || !['catalog', 'label'].includes(c.source.kind)) continue;
    if (!c.source.url && !c.source.page) continue;
    const sfm = lowNum(c.sfm, SPK(c.sfm.unit));
    const feed = packFeed(c.feed);
    if (!(sfm > 0) || !feed) continue;
    const coat = coatOf(t, c), cite = { brand: brandName(t.brand), series: t.series || '', page: c.source.page || '', url: c.source.url || '', catalog: c.source.catalog || '' };
    const add = (dia, fpt) => { if (!(dia > 0) || !(fpt > 0)) return; consider({ mode: t.mode, kind, sub, coat, iso: c.iso, dia: bandOf(dia), sfm, feed: fpt, feedKind: feed.kind, at: dia, ...cite }); };
    if (feed.range != null) {
      const dias = (t.diameters_in?.length ? t.diameters_in : t.diameters_mm?.map(x => x / 25.4)) || [];
      if (dias.length) dias.forEach(x => add(x, feed.range));
      else add(0.5, feed.range);
    }
    for (const [dia, v] of feed.points ?? []) add(dia, v);
    for (const [a, b, v] of feed.bands ?? []) add((a + b) / 2, v);
  }
}
export function baselineDoc() {
  const cells = [...CELLS.values()];
  const coats = [...new Set(cells.map(c => c.coat))].filter(c => c && c !== 'unspecified').sort();
  const kinds = {};
  for (const c of cells) (kinds[c.mode] ??= new Set()).add(c.kind);
  return {
    note: 'GENERATED from published catalog rows by scripts/build-index.mjs. Each cell is the lowest low end of one source row, not an average. Do not hand-edit.',
    coats, kinds: Object.fromEntries([...Object.entries(kinds)].map(([m, s]) => [m, [...s].sort()])),
    cells,
  };
}
function cellScore(c, q, relax) {
  if (c.mode !== q.mode) return null;
  if (q.feedKind && c.feedKind !== q.feedKind) return null;
  if (!relax) {
    if (c.kind !== q.kind || c.iso !== q.iso || c.coat !== q.coat) return null;
    if (c.sub !== q.sub && c.sub !== 'unspecified' && q.sub !== 'unspecified') return null;
  }
  const derived = [];
  let score = Math.abs(c.dia - q.d);
  if (c.kind !== q.kind) { score += 30; derived.push('type'); }
  if (c.iso !== q.iso) { score += 20; derived.push('material group'); }
  if (c.coat !== q.coat) { score += 8; derived.push('coating'); }
  if (c.sub !== q.sub) { score += c.sub === 'unspecified' || q.sub === 'unspecified' ? 3 : 12; derived.push('tool material'); }
  return { score, derived };
}
export function lookupBaseline(base, q, relax = true) {
  const cells = base?.cells || [];
  let best = null;
  for (const c of cells) {
    const s = cellScore(c, q, false);
    if (!s) continue;
    if (!best || s.score < best.score - 1e-9 || (Math.abs(s.score - best.score) < 1e-9 && c.sfm < best.c.sfm)) best = { c, ...s };
  }
  if (best || !relax) return best;
  for (const c of cells) {
    const s = cellScore(c, q, true);
    if (!s) continue;
    if (!best || s.score < best.score - 1e-9 || (Math.abs(s.score - best.score) < 1e-9 && c.sfm < best.c.sfm)) best = { c, ...s };
  }
  return best;
}
export function hasTinRow(base, q) {
  return !!(base?.cells || []).some(c => c.coat === 'tin' && c.mode === q.mode && c.kind === q.kind && c.iso === q.iso && c.feedKind === q.feedKind
    && (c.sub === q.sub || c.sub === 'unspecified' || q.sub === 'unspecified'));
}
// Generic / unknown tool: step-5 baseline only. "Not sure" is HSS. Coating unknown uses TiN, else uncoated.
export function genericQuote({ baseline, mode, kind, sub = 'hss', coat = 'uncoated', unsure = false, d, z = 4, iso, ae, ap, maxRpm = 0, maxHp = 0 }) {
  const useSub = unsure ? 'hss' : (sub || 'hss');
  const feedKind = mode === 'mill' ? 'fz' : 'ipr';
  let useCoat = coat === 'unknown' ? 'tin' : (coat || 'uncoated');
  let coatNote = '';
  if (coat === 'unknown') {
    if (hasTinRow(baseline, { mode, kind, sub: useSub, iso, feedKind })) coatNote = 'coating unknown, using TiN numbers';
    else { useCoat = 'uncoated'; coatNote = 'coating unknown, no TiN row for this combo, using uncoated numbers'; }
  }
  if (unsure && (coat === 'uncoated' || coat === '' || coat == null)) useCoat = 'uncoated';
  const q = { mode, kind, sub: useSub, coat: useCoat, iso, d, feedKind };
  let hit = lookupBaseline(baseline, q, false) || lookupBaseline(baseline, q, true);
  if (!hit) return null;
  let fpt = hit.c.feed, sfm = hit.c.sfm;
  const matWord = useSub === 'hss' ? 'HSS' : useSub;
  let text;
  if (unsure && useCoat === 'uncoated' && !coatNote) text = 'Generic HSS uncoated (tool material unknown)';
  else if (mode === 'mill') text = `Generic ${matWord} ${z}-fl baseline`;
  else text = `Generic ${matWord} baseline`;
  if (coatNote) text += '. ' + coatNote;
  const pg = pageNum(hit.c.page);
  const derived = hit.derived?.length ? ` Derived from the nearest sourced cell (${hit.derived.join(', ')}).` : '';
  text += `. Source: ${hit.c.brand} ${hit.c.series}${pg ? ' p. ' + pg : ''}.${derived}`;
  const runAe = ae != null ? ae : (mode === 'mill' ? 0.25 * d : d);
  let rpm = 0, ipm = 0, thin = null;
  if (mode === 'mill') { const o = compute({ sfm, d, fpt, z: z || 1, ae: runAe, ap: ap != null ? ap : d, stickout: 0, maxRpm, maxHp, iso }); rpm = o.rpm; ipm = o.ipm; thin = o.thin; }
  else if (mode === 'turn') { const o = turn({ sfm, d, ipr: fpt, ap: ap != null ? ap : 0.04, maxRpm }); rpm = o.rpm; ipm = o.ipm; }
  else { const o = drill({ sfm, d, ipr: fpt, maxRpm }); rpm = o.rpm; ipm = o.ipm; }
  return {
    step: 5, estimate: true, sfm, fpt, feedKind, rpm, ipm, thin, text, coatUsed: useCoat, coatNote, unsure,
    url: hit.c.url, page: hit.c.page, brand: hit.c.brand, series: hit.c.series, catalog: hit.c.catalog, derived: hit.derived || [],
  };
}
