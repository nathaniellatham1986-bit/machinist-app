// Convert the flat worker layout {brand, family, records:[...]} to schema 1 {schema, brand, tools:[{..., conditions}]}.
// Every record field is either mapped or the record is reported; nothing is silently dropped.
// Usage: node scripts/convert-flat.mjs <in.json> <out.json>     (exit 1 if any record could not be converted)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODE = { mill: 'mill', drill: 'drill', turn: 'turn', tap: 'tap', groove: 'turn', thread: 'turn' };
const TYPE = { groove: 'grooving / cut-off', thread: 'threading' };
const frac = s => { const m = String(s).match(/^(\d+)\/(\d+)$/); return m ? +m[1] / +m[2] : +s; };
const pct = s => { const m = String(s).match(/^([\d.]+)\s*%$/); return m ? +m[1] / 100 : NaN; };
const key = n => String(+n.toFixed(4));
const IN = 25.4;
const HANDLED = new Set(['mode', 'brand', 'series', 'grade', 'chipbreaker', 'iso', 'subgroup', 'coolant', 'coolantNote', 'insertWidth', 'feed', 'sfm', 'vc', 'status', 'source',
  'geometry', 'table', 'note', 'operation', 'fz', 'ap_over_Dc', 'kind', 'aeOverDc', 'insert', 'ap_in', 'rangeNote', 'ap', 'noseRadius_in', 'kr_deg', 'toolLife_min']);

function speed(v) { if (!v) return null; const { unit, ...r } = v; return { ...r, unit }; }
function byDia(m, dUnit, fUnit) { // keys must end up in the feed unit
  const out = {}; for (const [k, v] of Object.entries(m)) { let d = frac(k); if (!Number.isFinite(d)) throw new Error(`bad diameter key ${k}`);
    if (/^mm/.test(dUnit) && fUnit === 'in') d /= IN; if (/^in/.test(dUnit) && fUnit === 'mm') d *= IN;
    out[key(d)] = typeof v === 'number' ? v : v; } return out; }

export function convertRecord(r) {
  const extra = Object.keys(r).filter(k => !HANDLED.has(k)); if (extra.length) throw new Error(`unmapped field(s): ${extra.join(', ')}`);
  if (!MODE[r.mode]) throw new Error(`unknown mode ${r.mode}`);
  const c = {}; const tags = [];
  c.iso = r.iso ?? (r.subgroup ? 'O' : null); // non-ISO manufacturer groups (composites, graphite...) -> O, code kept in subgroup
  if (!c.iso) throw new Error('iso missing');
  if (r.subgroup) { c.subgroup = r.subgroup; tags.push(r.subgroup.replace(/^SMG v2 /, 'SMG ')); }
  for (const k of ['grade', 'insert', 'chipbreaker', 'geometry', 'operation', 'table', 'kind']) if (r[k] != null) c[k] = String(r[k]);
  if (r.insert) tags.push(r.insert); if (r.grade && !String(r.series).includes(r.grade)) tags.push(r.grade); if (r.chipbreaker) tags.push('cb ' + r.chipbreaker);
  if (r.geometry) tags.push('geom ' + r.geometry); if (r.operation) tags.push(r.operation);
  if (r.insertWidth) { c.insertWidth = { ...(isFinite(+r.insertWidth.label) ? { value: +r.insertWidth.label } : { label: r.insertWidth.label }), unit: r.insertWidth.unit }; tags.push(`w ${r.insertWidth.label} ${r.insertWidth.unit}`); }
  if (r.aeOverDc != null) { const w = pct(r.aeOverDc); if (!(w > 0)) throw new Error(`bad aeOverDc ${r.aeOverDc}`); c.woc = w; tags.push(`ae ${r.aeOverDc} of D`); }
  c.label = [r.series, ...tags].join(' · ');
  c.status = r.status;
  c.coolant = Array.isArray(r.coolant) ? r.coolant.join(', ') : (r.coolant ?? null);
  if (r.coolantNote) c.coolantNote = r.coolantNote;
  c.sfm = speed(r.sfm ?? r.vc ?? null);
  if (r.feed) { const { kind, unit, byDiameter_in, range, ...rest } = r.feed;
    const ranged = byDiameter_in && Object.keys(byDiameter_in).some(k => /^[\d.]+\s*-\s*[\d.]+$/.test(k));
    if (ranged) c.feed = { kind, unit, bands: Object.entries(byDiameter_in).map(([k, v]) => { const m = k.match(/^([\d.]+)\s*-\s*([\d.]+)$/);
      if (!m || typeof v !== 'number') throw new Error(`bad diameter band ${k}`); const f = unit === 'mm' ? IN : 1; return [+m[1] * f, +m[2] * f, v]; }) };
    else c.feed = { kind, unit, ...(byDiameter_in ? { byDiameter: byDia(byDiameter_in, 'in', unit) } : range ? { range } : { range: rest }) }; }
  if (r.fz) { const { unit, byDiameter, diameterUnit, byAeOverDc, ...rest } = r.fz; if (Object.keys(rest).length) throw new Error('unmapped fz keys');
    if (c.feed) throw new Error('both feed and fz');
    if (byDiameter) c.feed = { kind: 'fz', unit, byDiameter: byDia(byDiameter, diameterUnit ?? unit, unit) };
    else if (byAeOverDc) { const m = {}; for (const [k, v] of Object.entries(byAeOverDc)) { const w = pct(k); if (!(w > 0)) throw new Error(`bad ae key ${k}`); m[key(w)] = v; } c.feed = { kind: 'fz', unit, byWoc: m }; }
    else throw new Error('fz without byDiameter/byAeOverDc'); }
  if (r.ap) c.ap = r.ap.value != null ? { value: r.ap.value, unit: r.ap.unit } : r.ap;
  if (r.ap_in) { if (r.ap_in.recommended == null) throw new Error('ap_in without recommended'); c.ap = { value: r.ap_in.recommended, unit: 'in' }; }
  if (r.ap_over_Dc != null) c.apx = r.ap_over_Dc;
  if (r.noseRadius_in != null) c.noseRadius = { value: r.noseRadius_in, unit: 'in' };
  if (r.kr_deg != null) c.leadAngle = { deg: r.kr_deg, convention: 'entering angle kr' };
  if (r.toolLife_min != null) c.toolLife = r.toolLife_min;
  const notes = [r.note, r.rangeNote].filter(Boolean).join(' ');
  if (notes) c.note = notes;
  c.source = { kind: 'catalog', ...r.source, ...(r.source?.page != null ? { page: String(r.source.page) } : {}) };
  return c;
}

export function convert(doc) {
  if (!doc || !Array.isArray(doc.records)) throw new Error('not a flat file (needs records[])');
  const tools = new Map(); const errors = [];
  doc.records.forEach((r, i) => { try { const c = convertRecord(r); const mode = MODE[r.mode], k = `${mode}|${r.brand ?? doc.brand}|${r.series}`;
      if (!tools.has(k)) tools.set(k, { mode, brand: r.brand ?? doc.brand, series: r.series, ...(TYPE[r.mode] ? { type: TYPE[r.mode] } : {}), notes: `Family: ${doc.family}`, conditions: [] });
      tools.get(k).conditions.push(c); } catch (e) { errors.push(`records[${i}]: ${e.message}`); } });
  return { doc: { schema: 1, brand: doc.brand, tools: [...tools.values()] }, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [inp, out] = process.argv.slice(2);
  const { doc, errors } = convert(JSON.parse(fs.readFileSync(inp, 'utf8')));
  errors.forEach(e => console.error(`${inp}: ${e}`));
  if (!errors.length) fs.writeFileSync(out, JSON.stringify(doc));
  process.exit(errors.length ? 1 : 0);
}
