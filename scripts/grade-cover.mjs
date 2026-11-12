// Item 12: which printed line covers 304, which covers 316, and which is a lumped group.
// The remap only rewrites materials[] on rows that already link to ss304. Speeds and feeds are not touched.
// '304'  — 304 family, not 316: keep ss304
// '316'  — 316 family, not 304: ss316 instead of ss304
// 'both' — names both, or a plain austenitic / 300-series group: ss304 and ss316
// 'keep' — not a plain 304/316 cover (austenitic mixed with duplex, or no grade): leave the old ss304 link
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const stripHardness = s => String(s ?? '').replace(/[<>≤≥~]?\s*\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:HBW?|HRC|HRB|HV\d*|N\/mm²?|MPa|ksi)(?![A-Za-z])/gi, ' ')
  .replace(/\b(?:HBW?|HRC|HRB|HV)\s*[<>≤≥]?\s*\d+(?:[.,]\d+)?/gi, ' ');

// Designations the maker prints. EN/JIS names are that catalog's grade, not a handbook lookup.
const HAS304 = /\b304\s*SS\b|\b304(?!\s*L)(?![A-Za-z])|\b304\s*L\b|\b304H\b|\bSUS\s*304(?:\s*L)?\b|\b1\.4301\b|\b1\.4306\b|\b1\.4307\b|\bX5CrNi18-9\b|\bX5CrNi18-10\b|\bX2CrNi18-9\b|\bX2CrNi19-11\b/i;
const HAS316 = /\b316\s*SS\b|\b316(?!\s*L)(?!\s*Ti)(?![A-Za-z])|\b316\s*L\b|\b316\s*Ti\b|\bSUS\s*316(?:\s*L)?\b|\b1\.4401\b|\b1\.4404\b|\bX5CrNiMo17|\bX2CrNiMo17|\bX6CrNiMoTi17/i;

export function austeniticCover(text) {
  const s = stripHardness(text);
  const has304 = HAS304.test(s), has316 = HAS316.test(s);
  const aust = /austenit/i.test(s), series300 = /\b300\s*series\b/i.test(s), duplex = /duplex/i.test(s);
  if (has304 && has316) return 'both';
  if (has316 && !has304) {
    // "austenitic … examples SUS 316" is the group. 316 is the printed example, not a 316-only row.
    if (aust && /\bexamples?\b/i.test(s) && !duplex) return 'both';
    return '316';
  }
  if (has304 && !has316) {
    // "Austenitic stainless steel (SUS304, etc.)" is the group. A list that already names 303, or duplex, is not read as 316.
    if (aust && /\betc\.?\b/i.test(s) && !duplex && !/\b303\b/.test(s)) return 'both';
    return '304';
  }
  if (duplex) return 'keep';
  if (aust || series300) return 'both';
  return 'keep';
}

// Ids the automatic linker may add. A plain "austenitic" heading with no grade number is not auto-linked.
export function linkAusteniticIds(text) {
  const s = stripHardness(text);
  if (!HAS304.test(s) && !HAS316.test(s)) return [];
  const c = austeniticCover(text);
  if (c === 'both') return ['ss304', 'ss316'];
  if (c === '304') return ['ss304'];
  if (c === '316') return ['ss316'];
  return [];
}

export function mapAusteniticIds(mats, text) {
  if (!mats?.includes('ss304')) return mats ? mats.slice() : mats;
  const c = austeniticCover(text);
  if (c === '316') return mats.flatMap(id => id === 'ss304' ? ['ss316'] : [id]);
  if (c === 'both') return mats.includes('ss316') ? mats.slice() : mats.flatMap(id => id === 'ss304' ? ['ss304', 'ss316'] : [id]);
  return mats.slice();
}

const MAT_RE = /"materials"\s*:\s*\[[\s\S]*?\]/g;

function formatIds(ids, original) {
  const body = original.slice(original.indexOf('['));
  if (!body.includes('\n')) return '[' + ids.map(id => JSON.stringify(id)).join(',') + ']';
  const ind = (body.match(/\n(\s+)"/) || [, '      '])[1];
  const close = ind.length > 1 ? ind.slice(1) : '';
  return '[\n' + ids.map(id => ind + JSON.stringify(id)).join(',\n') + '\n' + close + ']';
}

// Rewrite materials arrays in place. Returns the number of conditions whose id list changed.
export function remapFile(raw) {
  const doc = JSON.parse(raw);
  if (!doc.tools) return { raw, n: 0 };
  const next = [];
  for (const t of doc.tools) for (const c of t.conditions) {
    if (!c.materials) continue;
    const text = c.sourceGroup || c.material || c.label || '';
    next.push(mapAusteniticIds(c.materials, text));
  }
  const hits = [...raw.matchAll(MAT_RE)];
  if (hits.length !== next.length) throw new Error(`materials arrays ${hits.length} != conditions ${next.length}`);
  let out = raw, n = 0, shift = 0;
  hits.forEach((h, i) => {
    const body = h[0].slice(h[0].indexOf('['));
    const cur = JSON.parse(body);
    if (JSON.stringify(cur) === JSON.stringify(next[i])) return;
    const repl = h[0].slice(0, h[0].indexOf('[')) + formatIds(next[i], h[0]);
    const at = h.index + shift;
    out = out.slice(0, at) + repl + out.slice(at + h[0].length);
    shift += repl.length - h[0].length;
    n++;
  });
  const check = JSON.parse(out);
  let k = 0;
  for (const t of check.tools) for (const c of t.conditions) {
    if (!c.materials) continue;
    if (JSON.stringify(c.materials) !== JSON.stringify(next[k])) throw new Error('remap verify failed at ' + k);
    k++;
  }
  return { raw: out, n };
}

if (process.argv[1]?.endsWith('grade-cover.mjs') && process.argv.includes('--apply')) {
  const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !['index.json', 'materials.json', 'threads.json'].includes(f) && !f.startsWith('_'));
  let rows = 0, touched = 0;
  for (const f of files) {
    const p = path.join(dataDir, f), raw = fs.readFileSync(p, 'utf8');
    const { raw: out, n } = remapFile(raw);
    if (!n) continue;
    if (!out.endsWith('\n') && raw.endsWith('\n')) fs.writeFileSync(p, out + '\n');
    else fs.writeFileSync(p, out);
    rows += n; touched++;
  }
  console.log(`remapped ${rows} conditions in ${touched} files`);
}
