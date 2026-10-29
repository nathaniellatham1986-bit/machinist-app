// Tag cited tool specs (substrate / flutes / coating / end shape) for ONE brand, only on tools that supply the everyday-material cells.
// Sources: (1) --ext <json>: maker product pages already fetched {seriesNo: {url, retrieved, material, coating, flutes}};
// (2) the tool record's own printed series/type title (copied from the maker's catalog), cited to that record's source.
// Never guesses: a field is set only when printed, and for multi-series records only when every series agrees. Never overwrites.
// Usage: node scripts/tag-specs.mjs "<Brand>" [--ext file.json] [--dry]
import fs from 'node:fs';
import { matchMat, matBad, kindOf, endGeom, brandName } from '../calc.js';
const [brand, ...rest] = process.argv.slice(2); const dry = rest.includes('--dry'); const ei = rest.indexOf('--ext');
const EXT = ei >= 0 ? JSON.parse(fs.readFileSync(rest[ei + 1])) : null;
const MATS = ['p-mild', '4140-ann', '4140-ht', 'ss304', 'ss17-4ph', 'al6061', 'gray-iron', 'ti64', 'ss303', 'brass-c360', 'ductile-iron'];
const KINDS = ['End mill', 'Drill', 'Tap', 'Thread mill'];
const M = JSON.parse(fs.readFileSync('data/materials.json')).materials.filter(m => MATS.includes(m.id));
export const coatClass = s => { s = String(s ?? ''); if (!s.trim()) return null;
  if (/diamond|\bDLC\b|\bCVD\b|\bPCD\b/i.test(s)) return 'diamond'; if (/\bZrN\b|TiB2/i.test(s)) return 'nonferrous';
  if (/AlTiN|TiAlN|AlCrN|AlTiCrN|TiSiN|AlTiSiN|\bnACo|nano-?FIREX|\bFIREX|nano-A\b|Super A|Signum|Sirius|X-?Power|\bAlCr|\bTiAl/i.test(s)) return 'al-based';
  if (/TiCN/i.test(s)) return 'ticn'; if (/\bTiN\b/i.test(s)) return 'tin';
  if (/uncoated|\bbright\b|steam oxide|\boxide\b|Perrox|Ferrox|bronze oxide/i.test(s)) return 'uncoated'; return null; };
const COAT_RX = /\b(AlTiN|TiAlN|AlCrN|AlTiCrN|TiSiN|AlTiSiN|TiCN|TiN|ZrN|TiB2|DLC|diamond|CVD diamond|nACo|nano-?FIREX|FIREX|uncoated|bright|steam oxide)\b/ig;
const sub = s => { const c = /carbide|\bVHM\b/i.test(s), h = /\bHSS|HSCO|HSS-?E|\bcobalt\b|\bM42\b|powder.?metal|\bPM\b/i.test(s); return c && !h ? 'carbide' : h && !c ? 'hss' : null; };
const fluteOf = s => { const v = [...new Set([...s.matchAll(/\b(\d{1,2})\s*[- ]?\s*(?:flutes?|FL)\b/ig)].map(m => +m[1]))]; const multi = /\d\s*\/\s*\d\s*(?:\/\s*\d\s*)?[- ]?flute/i.test(s); return v.length === 1 && !multi ? v[0] : null; };
const agree = a => { const v = [...new Set(a)]; return v.length === 1 && v[0] != null ? v[0] : null; };
const feeds = t => { for (const c of t.conditions || []) { if (!c.sfm || c.status === 'shop-proven' || !c.source || !['catalog', 'label'].includes(c.source.kind)) continue; for (const m of M) if (matchMat(m, c) && !matBad(m, c)) return true; } return false; };
const esc = (raw, s) => /\\u00[8-9a-f]|\\u[1-9a-f]/i.test(raw) ? s.replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) : s;
let n = 0, tagged = 0; const cnt = { substrate: 0, flutes: 0, coatingClass: 0, endShape: 0, cutOrForm: 0, fluteStyle: 0, holeType: 0 };
for (const f of fs.readdirSync('data').filter(f => f.endsWith('.json') && !['materials.json', 'index.json', 'threads.json', 'shop.json'].includes(f))) {
  const raw = fs.readFileSync('data/' + f, 'utf8'); let d; try { d = JSON.parse(raw); } catch { continue; } if (!d.tools) continue; let ch = false;
  for (const t of d.tools) {
    if (brandName(t.brand) !== brandName(brand) || !['mill', 'drill', 'tap'].includes(t.mode) || !KINDS.includes(kindOf(t)) || !feeds(t)) continue; n++;
    const sp = { ...(t.specs ?? {}) }; delete sp.source; const before = JSON.stringify(sp); let src = t.specs?.source ?? null, from = [], pgPrinted = [];
    if (EXT && (!EXT._mode || EXT._mode === t.mode)) { const nos = [...String(t.series).matchAll(/\b\d{3,5}\b/g)].map(m => m[0]); const pg = nos.map(x => EXT[x]);
      if (nos.length && pg.every(Boolean)) {
        const s1 = agree(pg.map(p => sub(p.material ?? ''))); if (s1 && !sp.substrate) sp.substrate = s1;
        const c1 = agree(pg.map(p => p.coating ?? null)); if (c1 && !sp.coating && coatClass(c1)) { sp.coating = c1; sp.coatingClass = coatClass(c1); }
        const f1 = agree(pg.map(p => p.flutes ?? null)); if (f1 && !sp.flutes) sp.flutes = +f1;
        if (t.mode === 'tap') for (const k of ['cutOrForm', 'fluteStyle', 'holeType']) { const v = agree(pg.map(p => p[k] ?? null)); if (v && !sp[k]) sp[k] = v; }
        if (JSON.stringify(sp) !== before) { from.push(...pg.map(p => p.url)); pgPrinted.push(...pg.filter(p => p.printed).map(p => `p.${p.page} "${p.printed}"`)); } } }
    const title = `${t.series} ${t.type ?? ''}`;
    const a = { substrate: sub(title), flutes: fluteOf(title), endShape: t.mode === 'mill' && kindOf(t) === 'End mill' ? endGeom(t) : null };
    const cm = [...new Set([...title.matchAll(COAT_RX)].map(m => m[0]))];
    let tt = false; for (const k of ['substrate', 'flutes', 'endShape']) if (a[k] != null && sp[k] == null) { sp[k] = a[k]; tt = true; }
    if (cm.length === 1 && !sp.coating && coatClass(cm[0])) { sp.coating = cm[0]; sp.coatingClass = coatClass(cm[0]); tt = true; }
    if (JSON.stringify(sp) === before) continue;
    const cs = t.conditions.find(c => c.source?.url)?.source;
    const parts = []; if (from.length) parts.push('maker page(s): ' + [...new Set(from)].join(' ; ') + (pgPrinted.length ? ` (printed: ${pgPrinted.join(' ; ')})` : ''));
    if (tt) parts.push(`printed tool title "${title.trim()}" in ${cs?.catalog ?? 'record source'}${cs?.page ? ' p.' + cs.page : ''}`);
    src = { url: from[0] ?? cs?.url, retrieved: new Date().toLocaleDateString('en-CA'), notes: parts.join(' | ') };
    for (const k of Object.keys(cnt)) if (sp[k] != null && !before.includes(`"${k}"`)) cnt[k]++;
    t.specs = { ...sp, source: src }; ch = true; tagged++; }
  if (ch && !dry) fs.writeFileSync('data/' + f, esc(raw, JSON.stringify(d, null, (raw.match(/^\{\n( +)"/) ?? [])[1]?.length) + (raw.endsWith('\n') ? '\n' : ''))); }
console.log(JSON.stringify({ brand, supplying: n, tagged, added: cnt }));
