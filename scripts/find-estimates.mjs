// Dev report: tool × material combos with NO manufacturer SFM/feed for the material that get an ESTIMATE. Usage: node scripts/find-estimates.mjs [cool]
import fs from 'node:fs'; import { estimate } from '../estimate.js'; import { matchMat, sizeRange, brandName } from '../calc.js';
const I = JSON.parse(fs.readFileSync('data/index.json')), cool = process.argv[2] ?? 'flood';
const all = I.files.flatMap(f => JSON.parse(fs.readFileSync('data/' + f.file)).tools.map((tool, i) => ({ key: f.file + '#' + i, tool, s: f.tools[i] })));
const byBrand = {}; all.forEach(x => (byBrand[brandName(x.tool.brand)] ??= []).push(x));
let n = 0, nS = 0, nF = 0, none = 0; const ex = [];
for (const x of all) { if (!['mill', 'drill', 'tap'].includes(x.tool.mode)) continue; const r = sizeRange(x.tool); if (!r) continue;
  const d = r[0] <= .5 && r[1] >= .5 ? .5 : r[0];
  for (const m of I.materials) { if (!(x.s.isos.includes(m.iso) || x.s.mats.includes(m.id))) continue;
    const cs = x.tool.conditions.filter(c => matchMat(m, c) && c.status !== 'shop-proven'), hasS = cs.some(c => c.sfm || c.printed), hasF = x.tool.mode === 'tap' || cs.some(c => c.feed || c.printed);
    if (hasS && hasF) continue;
    const e = estimate({ target: { ...x.s, mode: x.tool.mode }, targetKey: x.key, cands: byBrand[brandName(x.tool.brand)], mat: m, d, cool, need: { sfm: !hasS, fpt: !hasF } });
    if (e.sfm || e.fpt) { n++; if (e.sfm) nS++; if (e.fpt) nF++; ex.push([x.key, x.s.brand, x.s.series, m.id, d, !!e.sfm, !!e.fpt, cs.length]); } else none++; } }
console.log(JSON.stringify({ cool, combosWithEstimate: n, sfm: nS, fpt: nF, noDataNoEstimate: none }));
fs.writeFileSync('/tmp/est-examples.json', JSON.stringify(ex));
