// Audit through the picker's own code path: for each mode (Turn: each Operation), material and listed brand, count tools the
// tool list shows WITHOUT 'no data for this material' (dataRank < 2, the same function app.js fillTool uses).
// The old audit-brand-data.mjs checked only whether a brand had usable data anywhere in the mode, so Iscar Turn passed on its Thread rows.
// Usage: node scripts/audit-picker.mjs [brand...]
import fs from 'node:fs'; import { brandUsable, dataRank, turnOpsOf } from '../calc.js';
const MATS = JSON.parse(fs.readFileSync('data/materials.json')).materials, I = JSON.parse(fs.readFileSync('data/index.json'));
const SUM = I.files.flatMap(f => f.tools), SHOW = process.argv.slice(2).map(s => s.toLowerCase());
const opOk = (t, op) => { const o = turnOpsOf(t); return op === 'Face' ? o.includes('Turn') || o.includes('Face') : o.includes(op); };
export const pickerCounts = (mode, op, m, brand) => { const ts = SUM.filter(t => t.mode === mode && t.brand === brand && brandUsable(t, m, false) && (mode !== 'turn' || opOk(t, op)));
  return { ok: ts.filter(t => dataRank(t, m.id, m.iso) < 2).length, all: ts.length }; };
let n = 0; const by = {};
for (const mode of [...new Set(SUM.map(t => t.mode))]) for (const op of mode === 'turn' ? ['Turn', 'Face', 'Groove', 'Part', 'Thread'] : ['']) for (const m of MATS)
  for (const b of [...new Set(SUM.filter(t => t.mode === mode).map(t => t.brand))]) { const c = pickerCounts(mode, op, m, b); if (!c.all) continue;
    if (!c.ok) { n++; const k = mode + (op ? '/' + op : ''); by[k] = (by[k] ?? 0) + 1; }
    if (SHOW.some(s => b.toLowerCase().includes(s)) && mode === 'turn' && /^(4140-ann|p-mild|ss304)$/.test(m.id)) console.log(`  ${op} ${m.id} ${b}: ${c.ok}/${c.all}`); }
console.log(`picker path: ${n} mode×material×brand combos where the brand's tool list is all 'no data'`, JSON.stringify(by));
