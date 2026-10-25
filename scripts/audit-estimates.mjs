// Audit: how many tool × material combos get an ESTIMATE, with/without rule A (same end geometry) and B (own records name the material).
// Usage: node scripts/audit-estimates.mjs [-v]
import fs from 'node:fs'; import { estimate, EST_MODES } from '../estimate.js'; import { matchMat, kindOf, sizeRange } from '../calc.js';
const MATS = JSON.parse(fs.readFileSync('data/materials.json')).materials, I = JSON.parse(fs.readFileSync('data/index.json')), V = process.argv.includes('-v');
const FULL = {}, SUM = I.files.flatMap(f => { const D = JSON.parse(fs.readFileSync('data/' + f.file)), T = D.tools ?? D; return f.tools.map(t => { const key = f.file + '#' + t.i; FULL[key] = T[t.i]; return { ...t, key }; }); });
const cnt = { base: 0, A: 0, AB: 0 }, ex = [];
for (const s of SUM) { if (!EST_MODES.includes(s.mode) || s.shop) continue; const t = FULL[s.key]; if (!t) continue; const kd = kindOf(s);
  const r = sizeRange(t), d = r ? (r[0] + Math.min(r[1], r[0] * 4)) / 2 : 0.5;
  for (const m of MATS) { if (!(s.mats.includes(m.id) || s.isos.includes(m.iso) || s.isos.includes('*'))) continue;
    if (t.conditions.some(c => matchMat(m, c) && c.status !== 'shop-proven' && c.sfm && (c.feed || s.mode === 'tap'))) continue; // has data → no estimate
    const cands = SUM.filter(x => x.key !== s.key && x.brand === s.brand && x.mode === s.mode && kindOf(x) === kd && (x.mats.includes(m.id) || x.dataIsos.includes(m.iso))).map(x => ({ key: x.key, tool: FULL[x.key] }));
    if (!cands.length) continue; const go = o => { const e = estimate({ target: { ...s }, targetTool: t, targetKey: s.key, cands, mat: m, d, cool: 'flood', ...o }); return !!(e.sfm || e.fpt); };
    const b = go({ geom: false, own: false }); if (!b) continue; cnt.base++; const a = go({ own: false }), ab = a && go({});
    if (a) cnt.A++; if (ab) cnt.AB++; if (V && !ab) ex.push(`${s.brand} | ${s.series} | ${m.id} | drop ${a ? 'B' : 'A'}`); } }
console.log(`estimate combos: before ${cnt.base}; after A (end geometry) ${cnt.A} (drop ${cnt.base - cnt.A}); after A+B (own material) ${cnt.AB} (drop ${cnt.A - cnt.AB}); total drop ${cnt.base - cnt.AB}`);
if (V) ex.filter(x => /Emuge|Multi/i.test(x)).slice(0, 20).forEach(x => console.log(' ', x));
