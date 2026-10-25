// Audit: (mode, material, brand) combos where the brand is listed as having data but none of its tools has usable data
// (manufacturer SFM + feed in one record) for the material's ISO group. Usage: node scripts/audit-brand-data.mjs [old]
import fs from 'node:fs'; import { brandUsable } from '../calc.js';
const MATS = JSON.parse(fs.readFileSync('data/materials.json')).materials, I = JSON.parse(fs.readFileSync('data/index.json')), OLD = process.argv.includes('old');
const SUM = I.files.flatMap(f => f.tools);
const usable = (t, iso) => (t.fullIsos ?? []).some(x => { x = x.replace('~', ''); return x === '*' || x === iso; });
const old = (t, m) => (t.mats.includes(m.id) || t.isos.includes(m.iso) || t.isos.includes('*')) && t.dataIsos.some(i => i === '*' || i === m.iso);
const by = {}; let n = 0;
for (const m of MATS) for (const mode of [...new Set(SUM.map(t => t.mode))]) {
  const ts = SUM.filter(t => t.mode === mode && (OLD ? old(t, m) : brandUsable(t, m)));
  for (const b of new Set(ts.map(t => t.brand))) if (!ts.some(t => t.brand === b && usable(t, m.iso))) { n++; by[mode] = (by[mode] ?? 0) + 1; if (mode === 'turn' && /iscar/i.test(b) && m.id === '4140-ann') console.log('  e.g.', mode, b, m.id); } }
console.log(`${OLD ? 'before' : 'after'}: ${n} brand×material×mode combos listed with data but no usable tool`, JSON.stringify(by));
