// Audit: for every tool × material, which row would the default pick choose, and does that row name a different class
// or a hardness band that cannot be this material? Usage: node scripts/audit-materials.mjs [old] [-v]
import fs from 'node:fs'; import { matchMat, matPref, matPrefOld, matBad } from '../calc.js';
const MATS = JSON.parse(fs.readFileSync('data/materials.json')).materials, I = JSON.parse(fs.readFileSync('data/index.json'));
const pref = process.argv.includes('old') ? matPrefOld : (id, c) => matPref(id, c, MATS.find(m => m.id === id)), V = process.argv.includes('-v');
let n = 0, bad = 0, avoid = 0; const by = {};
for (const f of I.files) { const D = JSON.parse(fs.readFileSync('data/' + f.file)), tools = D.tools ?? D;
  for (const t of tools) for (const m of MATS) {
    const rows = (t.conditions ?? []).filter(c => c.sfm && c.source?.kind === 'catalog' && matchMat(m, c)); if (!rows.length) continue; n++;
    let r = rows; if (r.some(c => pref(m.id, c) === 0)) r = r.filter(c => pref(m.id, c) === 0); else if (r.some(c => pref(m.id, c) < 2)) r = r.filter(c => pref(m.id, c) < 2);
    const c = r[0]; if (matBad(m, c)) { bad++; if (rows.some(x => !matBad(m, x))) avoid++; const k = `${t.brand ?? f.file} | ${m.id}`; by[k] = (by[k] || 0) + 1; if (V) console.log(k, '|', t.series, '|', c.label, c.subgroup ?? ''); } } }
console.log(`combos ${n}, flagged ${bad} (avoidable: a non-flagged row existed ${avoid}; rest = tool only has other-class rows)`); Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(x => console.log(' ', x[1], x[0]));
