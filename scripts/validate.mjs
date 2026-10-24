// Validate brand data files against data/SCHEMA.md (schema 1).
// Usage: node scripts/validate.mjs [file ...]   (no args = every brand file in data/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NON_BRAND = new Set(['index.json', 'threads.json', 'materials.json']);
export const MATERIALS = JSON.parse(fs.readFileSync(new URL('../data/materials.json', import.meta.url))).materials;
const MAT = Object.fromEntries(MATERIALS.map(m => [m.id, m]));
const MODES = ['mill', 'drill', 'turn', 'tap'];
const ISO = ['P', 'M', 'K', 'N', 'S', 'H', 'O', '*'];
const STATUS = ['verified', 'derived', 'shop-proven'];
const KINDS = ['catalog', 'label', 'calculator', 'shop'];
const SPEED_UNITS = ['ft/min', 'm/min'];
const LEN_UNITS = ['in', 'mm'];
const FEED_KINDS = ['fz', 'ipr', 'pitch'];
const TOOL_KEYS = new Set(['mode', 'brand', 'series', 'type', 'flutes', 'coating', 'grade', 'diameters_in', 'diameters_mm', 'notes', 'conditions']);
const COND_KEYS = new Set(['label', 'iso', 'subgroup', 'material', 'status', 'coolant', 'sfm', 'feed', 'ap', 'ae', 'apx', 'aex', 'source', 'materials', 'sourceGroup',
  'noseRadius', 'leadAngle', 'toolLife', 'insertWidth', 'chipbreaker', 'geometry', 'kind', 'table', 'woc', 'operation', 'insert', 'grade', 'note', 'coolantNote', 'altSources']);
const SRC_KEYS = new Set(['kind', 'manufacturer', 'catalog', 'edition', 'url', 'page', 'notes', 'derivation', 'retrieved']);

const isNum = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isStr = v => typeof v === 'string' && v.trim().length > 0;

function range(r, where, err, { allowStart = true } = {}) {
  if (!r || typeof r !== 'object') return err(where, 'must be an object');
  const keys = Object.keys(r).filter(k => !['unit'].includes(k));
  for (const k of keys) if (!['value', 'min', 'max', 'start'].includes(k)) err(where, `unknown key "${k}"`);
  for (const k of ['value', 'min', 'max', 'start']) if (k in r && !isNum(r[k])) err(where, `${k} must be a non-negative number`);
  if ('value' in r) { if (['min', 'max', 'start'].some(k => k in r)) err(where, 'use either value or min/max/start, not both'); return; }
  if (!('max' in r) && !('start' in r)) err(where, 'needs value, start, or max (with optional min)');
  if ('min' in r && !('max' in r)) err(where, 'min requires max');
  if ('start' in r && !allowStart) err(where, 'start not allowed here');
  if (isNum(r.min) && isNum(r.max) && r.min > r.max) err(where, `min ${r.min} > max ${r.max}`);
  if (isNum(r.start) && ((isNum(r.min) && r.start < r.min) || (isNum(r.max) && r.start > r.max))) err(where, 'start outside min..max');
}

function source(s, c, where, err) {
  if (!s || typeof s !== 'object') return err(where, 'source is required');
  for (const k of Object.keys(s)) if (!SRC_KEYS.has(k)) err(where, `unknown source key "${k}"`);
  if (!KINDS.includes(s.kind)) err(where, `source.kind must be one of ${KINDS.join('|')}`);
  for (const k of ['manufacturer', 'catalog', 'edition']) if (!isStr(s[k])) err(where, `source.${k} is required`);
  if (['catalog', 'calculator'].includes(s.kind) && !(isStr(s.url) && /^https?:\/\//.test(s.url))) err(where, 'source.url (http/https) is required for catalog and calculator sources');
  if (s.url != null && !(isStr(s.url) && /^https?:\/\//.test(s.url))) err(where, 'source.url must be http(s) or null');
  if (s.page != null && !isStr(String(s.page))) err(where, 'source.page must be a string');
  if (c.status === 'derived' && !isStr(s.derivation)) err(where, 'status "derived" requires source.derivation (how the value was derived)');
  if (c.status !== 'derived' && 'derivation' in s) err(where, 'source.derivation is only for status "derived"');
  if ((s.kind === 'shop') !== (c.status === 'shop-proven')) err(where, 'source.kind "shop" and status "shop-proven" go together');
  if (/generic|handbook/i.test(s.manufacturer)) err(where, 'source.manufacturer must be a tool manufacturer (no generic/handbook data)');
}

function feed(f, where, err) {
  if (f === null) return;
  if (!f || typeof f !== 'object') return err(where, 'feed must be an object or null');
  if (!FEED_KINDS.includes(f.kind)) err(where, `feed.kind must be one of ${FEED_KINDS.join('|')}`);
  if (!LEN_UNITS.includes(f.unit)) err(where, `feed.unit must be one of ${LEN_UNITS.join('|')}`);
  const forms = ['range', 'bands', 'byDiameter', 'byWoc'].filter(k => k in f);
  if (forms.length !== 1) return err(where, 'feed needs exactly one of range | bands | byDiameter | byWoc');
  if (f.range) range(f.range, where + '.range', err);
  if (f.bands) {
    if (!Array.isArray(f.bands) || !f.bands.length) err(where, 'feed.bands must be a non-empty array');
    else f.bands.forEach((b, i) => { if (!Array.isArray(b) || b.length !== 3 || !b.every(isNum) || b[0] > b[1]) err(`${where}.bands[${i}]`, 'must be [dMin, dMax, feed] with dMin <= dMax'); });
  }
  if (f.byWoc) { const e = Object.entries(f.byWoc); if (!e.length) err(where, 'feed.byWoc is empty');
    for (const [k, v] of e) { if (!(+k > 0 && +k <= 1)) err(`${where}.byWoc`, `key "${k}" must be ae/D as a fraction 0-1`);
      if (typeof v === 'number') { if (!isNum(v)) err(`${where}.byWoc.${k}`, 'must be a number'); } else range(v, `${where}.byWoc.${k}`, err); } }
  if (f.byDiameter) {
    const e = Object.entries(f.byDiameter); if (!e.length) err(where, 'feed.byDiameter is empty');
    for (const [d, v] of e) { if (!isNum(+d) || +d === 0) err(`${where}.byDiameter`, `key "${d}" must be a diameter number`);
      else if (Math.abs(+d) > (f.unit === 'mm' ? 80 : 3)) err(`${where}.byDiameter`, `key "${d}" is over ${f.unit === 'mm' ? '80 mm' : '3 in'}: likely a lost decimal point`);
      if (typeof v === 'number') { if (!isNum(v)) err(`${where}.byDiameter.${d}`, 'must be a non-negative number'); } else range(v, `${where}.byDiameter.${d}`, err); }
  }
}

function depth(a, where, err) {
  if (!a || typeof a !== 'object') return err(where, 'must be an object');
  if (!LEN_UNITS.includes(a.unit)) err(where, `unit must be one of ${LEN_UNITS.join('|')}`);
  if ('value' in a) { if (!isNum(a.value) || 'max' in a || 'min' in a) err(where, 'value is a single stated depth; use it alone'); }
  else if (!isNum(a.max)) err(where, 'max (or value) is required');
  if ('min' in a && !isNum(a.min)) err(where, 'min must be a number');
  if (isNum(a.min) && isNum(a.max) && a.min > a.max) err(where, 'min > max');
  for (const k of Object.keys(a)) if (!['min', 'max', 'value', 'unit'].includes(k)) err(where, `unknown key "${k}"`);
}

export function validate(doc, name = 'file') {
  const errors = []; const err = (where, msg) => errors.push(`${name}: ${where}: ${msg}`);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { err('$', 'top level must be an object'); return errors; }
  if (doc.schema !== 1) err('$', 'schema must be 1');
  if (!isStr(doc.brand)) err('$', 'brand is required');
  if (/generic/i.test(doc.brand ?? '')) err('$', 'generic brands are not allowed');
  if (!Array.isArray(doc.tools) || !doc.tools.length) { err('$', 'tools must be a non-empty array'); return errors; }
  doc.tools.forEach((t, ti) => {
    const tw = `tools[${ti}]`;
    for (const k of Object.keys(t)) if (!TOOL_KEYS.has(k)) err(tw, `unknown tool key "${k}"`);
    if (!MODES.includes(t.mode)) err(tw, `mode must be one of ${MODES.join('|')}`);
    if (!isStr(t.brand)) err(tw, 'brand is required');
    if (!isStr(t.series)) err(tw, 'series is required');
    if (/generic/i.test(t.brand ?? '')) err(tw, 'generic brands are not allowed');
    if (!Array.isArray(t.conditions)) return err(tw, 'conditions must be an array');
    if (!t.conditions.length && !isStr(t.notes)) err(tw, 'a tool with no conditions needs notes explaining the gap');
    t.conditions.forEach((c, ci) => {
      const w = `${tw}.conditions[${ci}]`;
      for (const k of Object.keys(c)) if (!COND_KEYS.has(k)) err(w, `unknown condition key "${k}"`);
      if (!isStr(c.label)) err(w, 'label is required');
      if (!ISO.includes(c.iso)) err(w, `iso must be one of ${ISO.join('|')}`);
      if (!STATUS.includes(c.status)) err(w, `status must be one of ${STATUS.join('|')}`);
      if (!('coolant' in c)) err(w, 'coolant is required (string as stated by the source, or null if not stated)');
      else if (c.coolant !== null && !isStr(c.coolant)) err(w, 'coolant must be a string or null');
      if (!('sfm' in c)) err(w, 'sfm is required (speed object, or null when the source gives none)');
      else if (c.sfm !== null) { range(c.sfm, w + '.sfm', err); if (!SPEED_UNITS.includes(c.sfm?.unit)) err(w + '.sfm', `unit must be one of ${SPEED_UNITS.join('|')}`); }
      if ('feed' in c) feed(c.feed, w + '.feed', err);
      if (c.sfm === null && c.feed == null && !c.ap && !c.coolant) err(w, 'condition carries no data (no speed, feed, depth or coolant)');
      if (c.feed?.kind === 'fz' && t.mode !== 'mill') err(w, 'feed.kind "fz" is for mill tools');
      if (c.feed?.kind === 'ipr' && t.mode === 'mill') err(w, 'mill tools use feed.kind "fz"');
      if (c.ap) depth(c.ap, w + '.ap', err); if (c.ae) depth(c.ae, w + '.ae', err);
      for (const k of ['apx', 'aex']) if (k in c && !(isNum(c[k]) && c[k] > 0)) err(w, `${k} must be a positive number (multiple of D)`);
      if ('materials' in c) {
        if (!Array.isArray(c.materials) || !c.materials.length) err(w, 'materials must be a non-empty array of ids from data/materials.json');
        else for (const m of c.materials) { if (!MAT[m]) err(w, `unknown material "${m}" (see data/materials.json)`); else if (c.iso !== '*' && MAT[m].iso !== c.iso) err(w, `material ${m} is ISO ${MAT[m].iso}, condition is ISO ${c.iso}`); }
        if (!isStr(c.sourceGroup)) err(w, "materials requires sourceGroup: the source's own wording for the material group");
        if (c.materials?.includes('ss303') && !/303|free.?machin|sulph|sulfur|austenitic/i.test(c.sourceGroup ?? '')) err(w, 'ss303 only when the source names 303, free-machining stainless, or austenitic stainless as a group');
        if (c.materials?.includes('ss304') && !/304|316|austenitic/i.test(c.sourceGroup ?? '')) err(w, 'ss304 only when the source names 304 or austenitic stainless');
      }
      if (c.iso === 'M' && /free.?machin/i.test(c.label) && /30[4]|316/.test(c.label) && !/303/.test(c.label)) err(w, '304/316 are not free-machining; keep 303 separate');
      if (c.materials?.includes('ss304') && /free.?machin|sulph|sulfur/i.test(c.sourceGroup ?? '') && !/304|316|austenitic/i.test(c.sourceGroup)) err(w, 'free-machining source group maps to ss303, not ss304');
      for (const k of ['noseRadius', 'insertWidth']) if (k in c) { const v = c[k]; if (!v || !LEN_UNITS.includes(v.unit) || !(isNum(v.value) || isStr(v.label))) err(w, `${k} must be {value|label, unit: in|mm}`); }
      if ('leadAngle' in c && !(isNum(c.leadAngle?.deg) && isStr(c.leadAngle?.convention))) err(w, 'leadAngle must be {deg, convention} (e.g. convention "entering angle kr")');
      if ('toolLife' in c && !(isNum(c.toolLife) && c.toolLife > 0)) err(w, 'toolLife must be minutes (number)');
      if ('woc' in c && !(isNum(c.woc) && c.woc > 0 && c.woc <= 1)) err(w, 'woc must be ae/D as a fraction 0-1');
      for (const k of ['chipbreaker', 'geometry', 'kind', 'table', 'operation', 'insert', 'grade', 'note', 'coolantNote']) if (k in c && !isStr(c[k])) err(w, `${k} must be a non-empty string`);
      source(c.source, c, w + '.source', err);
      if ('altSources' in c) { if (!Array.isArray(c.altSources) || !c.altSources.length) err(w, 'altSources must be a non-empty array');
        else c.altSources.forEach((a, j) => { const aw = `${w}.altSources[${j}]`; source(a?.source, c, aw + '.source', err);
          if (a?.sfm) range(a.sfm, aw + '.sfm', err); if (a?.feed) feed(a.feed, aw + '.feed', err);
          for (const k of Object.keys(a || {})) if (!['source', 'label', 'sfm', 'feed'].includes(k)) err(aw, `unknown altSources key "${k}"`); }); }
    });
  });
  return errors;
}

export function validateFile(p) {
  let doc; try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return [`${path.basename(p)}: not valid JSON: ${e.message}`]; }
  return validate(doc, path.basename(p));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
  const files = process.argv.slice(2).length ? process.argv.slice(2)
    : fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !NON_BRAND.has(f)).map(f => path.join(dataDir, f));
  let bad = 0;
  for (const f of files) { const e = validateFile(f); if (e.length) { bad++; e.forEach(x => console.error(x)); } else console.log(`ok ${path.basename(f)}`); }
  process.exit(bad ? 1 : 0);
}
