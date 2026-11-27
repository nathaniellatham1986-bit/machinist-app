// Feed fallback ladder and the step-5 baseline. Pure. Baseline cells are published catalog numbers
// (lowest low end in the cell, feed from that same row). Nothing here is averaged or invented.
import { pick, lowEnd, hrcToHb, matchMat, matBad, matPref, carbonBand, rowBits, hardnessBand, turnOpOf, cutOf, passOf, kindOf, brandName, compute, drill, turn } from './calc.js';

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
function packFeed(f, num = lowNum) {
  if (!f) return null;
  const k = toIn(1, f.unit), out = { kind: f.kind || 'fz' };
  if (f.byDiameter) out.points = Object.entries(f.byDiameter).map(([dia, v]) => [+dia * k, num(v, k)]).filter(x => x[1] > 0);
  if (f.bands) out.bands = f.bands.map(([a, b, v]) => [a * k, b * k, v * k]).filter(x => x[2] > 0);
  if (f.range) { const n = num(f.range, k); if (n > 0) out.range = n; }
  if (!out.points?.length && !out.bands?.length && out.range == null) return null;
  return out;
}
function feedAt(feed, d, nearest) {
  if (!feed || !(d > 0)) return null;
  if (feed.range != null) return { v: feed.range, exact: true, at: d };
  if (feed.bands) { const b = feed.bands.find(([a, z]) => d >= a - 1e-4 && d <= z + 1e-4); if (b) return { v: b[2], exact: true, at: d }; }
  let near = null;
  for (const [x, v] of feed.points ?? []) { // nearest printed size; within 0.02 in counts as that size
    const dist = Math.abs(x - d);
    if (!near || dist < near.dist) near = { v, at: x, dist, exact: false };
  }
  if (near && near.dist < 0.02) return { v: near.v, exact: true, at: near.at };
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
    sub: h.tool?.sub || h.sub || '',
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
const sameMetal = (a, b) => !!a && !!b && a === b;
export function noRowLine(tool, mat) {
  const series = String(tool?.series || '').replace(/^Series\s+/i, '');
  const what = { M: 'stainless', N: 'aluminum', K: 'cast iron', S: 'high-temp alloy', H: 'hardened steel', P: 'steel' }[mat?.iso] || 'this material';
  return `${tool?.brand || 'This tool'} ${series} prints no ${what} row.`;
}
// Guhring article numbers start with the series id (maker page Series=205). "205-18,260" maps only when one loaded series owns that id.
export function matchPart(text, tools) {
  const m = String(text || '').trim().match(/^(\d{3,4})(?:\b|[-/])/);
  if (!m) return null;
  const re = new RegExp(`Series\\s*${m[1]}(?:\\s*/|\\s+|$)`);
  const hits = (tools || []).filter(t => re.test(t.series || ''));
  const brands = [...new Set(hits.map(t => t.brand))];
  const series = [...new Set(hits.map(t => t.series))];
  if (!hits.length || brands.length !== 1 || series.length !== 1) return null;
  return { brand: brands[0], series: series[0], key: hits[0].key, mode: hits[0].mode || '' };
}
export function resolveFeed({ tool, mat, iso, mode, cut = '', d, pool = [], baseline = null, maxStep = 5, strictMetal = true }) {
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
    if (tool?.kind && t.kind !== tool.kind) return null;
    if (strictMetal && !sameMetal(tool?.sub, t.sub)) return null;
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
  const cell = strictMetal ? lookupSameMetal(baseline, q) : lookupBaseline(baseline, q, true);
  if (!cell) return null;
  const h = { brand: cell.c.brand, series: cell.c.series, page: cell.c.page, url: cell.c.url, catalog: cell.c.catalog, sfm: cell.c.sfm, fpt: cell.c.feed, factor: cut === 'Slot' ? SLOT_FACTOR : 1, derived: cell.derived, feedKind: cell.c.feedKind, row: null, sub: cell.c.sub };
  if (h.factor === SLOT_FACTOR) h.fpt *= SLOT_FACTOR;
  return packHit(5, h, target);
}

// ---- step 5 baseline, built from catalog rows already in data/ ----
// Cell shape: { mode, kind, sub, coat, iso, dia, feedKind, op?, mat?, tier?, hb?, sfm, feed, at, brand, series, page, url, catalog, row }.
// No mat = ISO-group cell (median of every row in the group). mat = cell for one app material, built only from rows that
// match it (tier: see matTier). Numbers are the row's printed low end.
const CELLS = new Map();
const SPECIALTY = /micro|miniature|long.?reach|reduced.?neck|barrel|deep.?hole|high.?feed|hi.?feed/i;
const SUPERHARD = /\bCBN\b|\bPCD\b|ceramic|cermet|diamond|SUMIBORON|SUMIDIA|\bBNC?\d/i;
const HT_WORDS = /harden|heat.?treated|pre.?hard|quench|\btempered\b|Verg[uü]t/i;
let MATS = [];
export function resetBaseline() { CELLS.clear(); }
export function setBaselineMaterials(list) { MATS = list || []; }
// Low end of the printed range: the safe end of the maker's own numbers. A printed start is used only when no minimum is printed.
const minNum = (spec, k) => { if (spec == null) return null; const v = typeof spec === 'number' ? spec : spec.min ?? spec.value ?? spec.start ?? spec.max; return v > 0 ? v * k : null; };
// Rows printed for a light radial cut (finishing, HEM, ae/D under 25%) do not serve the default 25% stepover.
export function lightRow(c) {
  const s = `${c?.operation ?? ''} ${c?.label ?? ''}`;
  if (/\bfinish/i.test(s) || cutOf(c) === 'HEM') return true;
  const m = s.match(/a[er]\s*\/\s*Dc?\s*=\s*(\d*\.?\d+)/i) || s.match(/\ba[er]\s*=\s*(\d*\.?\d+)\s*[x×]?\s*D\b/i);
  if (m && +m[1] < 0.25) return true;
  const r = radialLimit(c); return !!r && r.maxFrac != null && r.maxFrac < 0.25;
}
// A row printed for a diameter span in its label ("dia 1/4"-1/2"", "dia 1/8""). Inches. null when the label names none.
const frac = x => { const [a, b] = x.split('/'); return b ? +a / +b : +a; };
export function diaSpan(label) {
  const m = String(label ?? '').match(/\bdia\.?\s*(\d+(?:\/\d+)?(?:\.\d+)?)\s*(?:"|in)?(?:\s*(?:-|–|to)\s*(\d+(?:\/\d+)?(?:\.\d+)?)\s*(?:"|in)?)?/i);
  if (!m) return null; const a = frac(m[1]), b = m[2] ? frac(m[2]) : a; return a > 0 && b >= a ? [a, b] : null;
}
// Printed hardness band in HB. Adds "Rc over 32" / "HRC under 32" wording, which hardnessBand does not read.
const rowBand = s => { const b = hardnessBand(s); if (b) return b; const m = String(s).match(/\b(?:Rc|HRc|HRC)\s*(over|above|under|below)\s*(\d+)/i);
  if (!m) return null; const hb = hrcToHb(+m[2]); return /over|above/i.test(m[1]) ? [hb, 9999] : [0, hb]; };
// How well a printed row fits an app material, lower is better: 0-1 names the grade, 2-3 names its class, 4-5 matches only by
// printed hardness (odd = hardness window broader than the pick). null = it does not serve this material.
export function matTier(m, c) {
  if (!m || !matchMat(m, c) || matBad(m, c)) return null;
  const s = rowBits(c), band = rowBand(s);
  if (m.hb && band && !(band[0] <= m.hb[1] && band[1] >= m.hb[0])) return null;
  if (m.id === 'p-mild' && carbonBand(s) === 'med') return null; // 1045/1050 rows are not mild steel
  if (m.hb && m.hb[0] >= 250 && !band && !HT_WORDS.test(s)) return null; // heat-treated pick: the row must print a hardness or say hardened
  if (m.hb && m.hb[1] <= 240 && !band && HT_WORDS.test(s)) return null; // annealed pick: never a hardened row
  // A heat-treated pick prefers rows printed for a window above annealed; an annealed pick prefers rows that stop near annealed.
  const broad = !m.hb ? 0 : m.hb[0] >= 250 ? (band && band[0] >= 200 ? 0 : 1) : m.hb[1] <= 240 ? (band && band[1] <= 310 ? 0 : 1) : 0;
  if (matchMat(m, c) === 'named') return broad;
  if (matPref(m.id, c, m) === 0) return 2 + broad;
  return m.hb && band ? 4 + broad : null;
}
// One printed row per cell. Odd count: the middle row. Even count: the lower of the two middle rows. Not an average.
export function medianRow(rows) {
  if (!rows?.length) return null;
  const s = rows.slice().sort((a, b) => a.sfm - b.sfm || (a.feed ?? 0) - (b.feed ?? 0) || String(a.brand).localeCompare(String(b.brand)) || String(a.series).localeCompare(String(b.series)));
  return s[Math.floor((s.length - 1) / 2)];
}
function consider(cell, rowId) {
  const k = [cell.mode, cell.kind, cell.sub, cell.coat, cell.iso, cell.dia, cell.feedKind, cell.op ?? '', cell.mat ?? ''].join('|');
  const list = CELLS.get(k) ?? [];
  const prev = list.find(x => x.rowId === rowId);
  if (!prev || Math.abs(cell.at - cell.dia) < Math.abs(prev.at - prev.dia)) {
    if (prev) list[list.indexOf(prev)] = { ...cell, rowId };
    else list.push({ ...cell, rowId });
    CELLS.set(k, list);
  }
}
export function noteBaseline(t) {
  if (!t?.conditions) return;
  if (SPECIALTY.test(`${t.series ?? ''} ${t.type ?? ''}`)) return;
  const sub = substrateOf(t), kind = kindOf(t), tap = t.mode === 'tap';
  for (const c of t.conditions) {
    if (!c?.sfm || (!c.feed && !tap) || c.status === 'shop-proven' || c.paired || c.iso === '*' || !c.source || !['catalog', 'label'].includes(c.source.kind)) continue;
    if (!pageNum(c.source.page) || lightRow(c)) continue; // every baseline number cites a page; light-cut rows stay out
    const sfm = minNum(c.sfm, SPK(c.sfm.unit));
    const feed = tap ? null : packFeed(c.feed, minNum);
    if (!(sfm > 0) || (!tap && !feed)) continue;
    const coat = coatOf(t, c), cite = { brand: brandName(t.brand), series: t.series || '', page: c.source.page || '', url: c.source.url || '', catalog: c.source.catalog || '', row: String(c.sourceGroup || c.label || '').slice(0, 140) };
    const hb = hardnessBand(rowBits(c)), extra = hb ? { hb: hb.map(Math.round) } : {};
    if (t.mode === 'turn') extra.op = SUPERHARD.test(`${t.series ?? ''} ${t.type ?? ''} ${t.grade ?? ''} ${c.grade ?? ''} ${c.label ?? ''}`) ? 'Superhard' : turnOpOf(t, c);
    // Same ISO group. Plastics (app group O) also take rows that name them under another group (ISCAR files "fiber plastics" under N).
    const mats = MATS.map(m => [m.id, m.iso === c.iso ? matTier(m, c) : m.iso === 'O' && matchMat(m, c) === 'named' ? matTier(m, c) : null]).filter(([, k]) => k != null);
    const rowId = `${cite.brand}|${cite.series}|${c.label || ''}|${c.iso}|${sfm}`;
    const put = cell => { consider(cell, rowId); for (const [mat, tier] of mats) consider({ ...cell, mat, tier }, rowId); };
    if (tap) { put({ mode: t.mode, kind, sub, coat, iso: c.iso, dia: 0.5, sfm, feed: null, feedKind: 'pitch', at: 0.5, ...extra, ...cite }); continue; }
    const add = (dia, fpt) => {
      if (!(dia >= 1 / 16) || !(fpt > 0)) return; // under 1/16 in stays out of general cells
      const band = bandOf(dia);
      if (Math.max(dia, band) / Math.min(dia, band) > 2) return; // same kind and substrate already; diameter within about 2x
      put({ mode: t.mode, kind, sub, coat, iso: c.iso, dia: band, sfm, feed: fpt, feedKind: feed.kind, at: dia, ...extra, ...cite });
    };
    if (feed.range != null) {
      const span = diaSpan(c.label), dias = (t.diameters_in?.length ? t.diameters_in : t.diameters_mm?.map(x => x / 25.4)) || [];
      if (span) { const inSpan = DIA_BANDS.filter(x => x >= span[0] - 1e-6 && x <= span[1] + 1e-6); (inSpan.length ? inSpan : [(span[0] + span[1]) / 2]).forEach(x => add(x, feed.range)); }
      else if (dias.length) dias.forEach(x => add(x, feed.range));
      else add(0.5, feed.range);
    }
    for (const [dia, v] of feed.points ?? []) add(dia, v);
    for (const [a, b, v] of feed.bands ?? []) add((a + b) / 2, v);
  }
}
export function baselineDoc() {
  const cells = [...CELLS.values()].map(list => {
    const best = Math.min(...list.map(x => x.tier ?? 0)), rows = list.filter(x => (x.tier ?? 0) === best);
    const row = medianRow(rows);
    if (!row) return null; const { rowId, ...cell } = row; return cell; }).filter(Boolean);
  const coats = [...new Set(cells.map(c => c.coat))].filter(c => c && c !== 'unspecified').sort();
  const kinds = {};
  for (const c of cells) (kinds[c.mode] ??= new Set()).add(c.kind);
  return {
    note: 'GENERATED from published catalog rows by scripts/build-index.mjs. Each cell is the median printed row (lower of the two middle rows when the count is even), at the low end of its printed range, not an average. Cells with "mat" hold only rows matched to that material (most specific rows only). Do not hand-edit.',
    coats, kinds: Object.fromEntries([...Object.entries(kinds)].map(([m, s]) => [m, [...s].sort()])),
    cells,
  };
}
function cellScore(c, q, relax) {
  if (c.mat || c.mode !== q.mode) return null;
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
export function lookupSameMetal(base, q) {
  let best = null;
  for (const c of base?.cells || []) {
    if (c.mat || c.mode !== q.mode || c.kind !== q.kind || c.iso !== q.iso) continue;
    if (q.feedKind && c.feedKind !== q.feedKind) continue;
    if (!sameMetal(q.sub || 'unspecified', c.sub || 'unspecified')) continue;
    let score = Math.abs(c.dia - q.d);
    const derived = [];
    if (c.coat !== q.coat) { score += 5; derived.push('coating'); }
    if (!best || score < best.score - 1e-9 || (Math.abs(score - best.score) < 1e-9 && c.sfm < best.c.sfm)) best = { c, score, derived };
  }
  return best;
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
  return !!(base?.cells || []).some(c => !c.mat && c.coat === 'tin' && c.mode === q.mode && c.kind === q.kind && c.iso === q.iso && c.feedKind === q.feedKind
    && (c.sub === q.sub || c.sub === 'unspecified' || q.sub === 'unspecified'));
}
// Generic pick: the material's own cell first, then the ISO-group cell (labeled), never a row whose printed hardness misses the material's.
const COATED = c => !!c && c !== 'uncoated' && c !== 'unspecified';
const coatPen = (cell, want) => cell === want ? 0 : cell === 'unspecified' ? 1 : want === 'uncoated' || cell === 'uncoated' ? 5 : 3;
export function genericCell(base, q, mat) {
  const ok = c => c.mode === q.mode && c.kind === q.kind && c.feedKind === q.feedKind && q.subs.includes(c.sub || 'unspecified') && (q.mode !== 'turn' || c.op === 'Turn');
  const score = c => Math.abs(c.dia - q.d) + coatPen(c.coat, q.coat) + q.subs.indexOf(c.sub || 'unspecified') * 10;
  const best = list => list.reduce((b, c) => { const s = score(c); return !b || s < b.s - 1e-9 || (Math.abs(s - b.s) < 1e-9 && c.sfm < b.c.sfm) ? { c, s } : b; }, null);
  const cells = base?.cells || [];
  if (mat) { const hit = best(cells.filter(c => c.mat === mat.id && ok(c))); if (hit) return { c: hit.c, group: false }; }
  const hbOk = c => !mat?.hb || !c.hb || (c.hb[0] <= mat.hb[1] && c.hb[1] >= mat.hb[0]);
  const hit = best(cells.filter(c => !c.mat && c.iso === q.iso && ok(c) && hbOk(c)));
  return hit ? { c: hit.c, group: true } : null;
}
const HARD = m => !!m && (m.iso === 'H' || (m.hb && m.hb[0] >= 371)); // about 40 HRC and up
const inchMm = x => `${x.toFixed(3)} in (${(x * 25.4).toFixed(1)} mm)`;
// Generic / unknown tool: step-5 baseline only. "Not sure" is HSS. Coating unknown uses TiN, else uncoated.
export function genericQuote({ baseline, mode, kind, sub = 'hss', coat = 'uncoated', unsure = false, d, z = 4, iso, mat = null, ae, ap, pitch, maxRpm = 0, maxHp = 0 }) {
  iso = mat?.iso || iso;
  let useSub = mode === 'turn' ? 'carbide' : mode === 'tap' ? 'hss' : unsure ? 'hss' : (sub || 'hss'), warn = '', caution = '';
  if ((mode === 'mill' || mode === 'drill') && HARD(mat) && (useSub === 'hss' || useSub === 'cobalt')) { warn = 'No maker prints HSS above ~40 HRC — use carbide. Numbers shown are for a carbide tool.'; useSub = 'carbide'; }
  const feedKind = mode === 'mill' ? 'fz' : mode === 'tap' ? 'pitch' : 'ipr';
  let useCoat = coat === 'unknown' ? 'tin' : (coat || 'uncoated');
  let coatNote = '';
  if (coat === 'unknown') {
    if (hasTinRow(baseline, { mode, kind, sub: useSub, iso, feedKind })) coatNote = 'coating unknown, using TiN numbers';
    else { useCoat = 'uncoated'; coatNote = 'coating unknown, no TiN row for this combo, using uncoated numbers'; }
  }
  if (unsure && (coat === 'uncoated' || coat === '' || coat == null)) useCoat = 'uncoated';
  const subs = mode === 'turn' ? ['carbide', 'unspecified'] : mode === 'tap' ? ['hss', 'cobalt', 'unspecified'] : [useSub];
  const q = { mode, kind, iso, d, feedKind, coat: useCoat, subs };
  let hit = genericCell(baseline, q, mat), subNote = '';
  // No row for the picked tool material: use the next one that runs no faster (HSS <-> cobalt; carbide -> cobalt/HSS), labeled.
  const ALT = { hss: [['cobalt', 'No plain HSS row printed; HSS-Co (cobalt) row used']], cobalt: [['hss', 'No cobalt row printed; plain HSS row used']],
    carbide: [['cobalt', 'No carbide row printed; cobalt row used (slower than carbide)'], ['hss', 'No carbide row printed; HSS row used (slower than carbide)']] };
  if (mode === 'mill' || mode === 'drill') for (const [alt, note] of ALT[useSub] || []) { if (hit) break; hit = genericCell(baseline, { ...q, subs: [alt] }, mat); if (hit) subNote = note; }
  if (!hit) return null;
  const c = hit.c, sfm = c.sfm, fpt = mode === 'tap' ? (pitch ?? null) : c.feed;
  const matWord = { hss: 'HSS', cobalt: 'cobalt', carbide: 'carbide' }[useSub] || useSub;
  if (useCoat === 'uncoated' && COATED(c.coat)) caution = `Coated-tool number. Uncoated ${matWord} needs a slower speed.`;
  let text;
  if (unsure && useCoat === 'uncoated' && !coatNote && !warn) text = 'Generic HSS uncoated (tool material unknown)';
  else if (mode === 'mill') text = `Generic ${matWord} ${z}-fl baseline`;
  else if (mode === 'turn') text = 'Generic carbide insert, turning baseline';
  else if (mode === 'tap') text = 'Generic tap baseline';
  else text = `Generic ${matWord} baseline`;
  if (coatNote) text += '. ' + coatNote;
  const short = String(mat?.name || '').replace(/\s*\(.*$/, '');
  text += '. ' + (hit.group ? `Group number (ISO ${iso})${short ? `, not ${short}-specific` : ''}` : c.tier >= 4 ? `Matched by printed hardness, not a ${short} row` : `${short} row`);
  if (subNote) text += '. ' + subNote;
  const pg = pageNum(c.page);
  text += `. Low end of printed range. Source: ${c.brand} ${c.series}${pg ? ' p. ' + pg : ''}${c.row ? `, row “${c.row}”` : ''}.`;
  if ((mode === 'mill' || mode === 'drill') && c.at > 0 && Math.abs(c.at - d) > 0.01) text += ` Printed for the ${inchMm(c.at)} size, used for ${inchMm(d)}.`;
  const runAe = ae != null ? ae : (mode === 'mill' ? 0.25 * d : d);
  let rpm = 0, ipm = 0, thin = null;
  if (mode === 'mill') { const o = compute({ sfm, d, fpt, z: z || 1, ae: runAe, ap: ap != null ? ap : d, stickout: 0, maxRpm, maxHp, iso }); rpm = o.rpm; ipm = o.ipm; thin = o.thin; }
  else if (mode === 'turn') { const o = turn({ sfm, d, ipr: fpt, ap: ap != null ? ap : 0.04, maxRpm }); rpm = o.rpm; ipm = o.ipm; }
  else { const o = drill({ sfm, d, ipr: fpt ?? 0, maxRpm }); rpm = o.rpm; ipm = o.ipm; }
  return {
    step: 5, estimate: true, sfm, fpt, feedKind, rpm, ipm, thin, text, warn, caution, group: hit.group, coatUsed: useCoat, coatNote, unsure,
    url: c.url, page: c.page, brand: c.brand, series: c.series, catalog: c.catalog, derived: [],
  };
}
